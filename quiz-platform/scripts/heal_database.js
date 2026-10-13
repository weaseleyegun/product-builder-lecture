import { createClient } from '@supabase/supabase-js';
import ytdl from 'ytdl-core';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.dev.vars') });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

function cleanTitle(ytTitle) {
    if (!ytTitle) return '';
    // Strip common YouTube fluff
    let str = ytTitle
        .replace(/\[.*?\]/g, '') // remove [MV], [TJ노래방]
        .replace(/\(.*?MV.*?\)/gi, '') // remove (MV)
        .replace(/\(.*?Official.*?\)/gi, '')
        .replace(/Official Music Video/gi, '')
        .replace(/Music Video/gi, '')
        .replace(/M\/V/gi, '')
        .replace(/MV/g, '')
        .replace(/@.*?/g, '') // remove @channel
        .replace(/\|.*/g, '') // remove anything after |
        .replace(/".*?"/g, match => match.replace(/"/g, '')) // remove quotes holding the title
        .trim();

    return str;
}

// Compute similarity between DB answer and actual video title
function needsHealing(dbAnswer, ytTitle) {
    let cleanDb = dbAnswer.toLowerCase().replace(/\s+/g, '');
    let cleanYt = ytTitle.toLowerCase().replace(/\s+/g, '');

    // If they share a significant chunk, it might be fine, but let's check strict subsets
    // For example, "눈물이 있어" is NOT a substring of "LeeSSang(리쌍) _ Tears(눈물) (Feat. Eugene(유진) of THE SEEYA) MV"
    // "이 사람이다" is NOT a substring of "[MV] 한동근 ‘이 소설의 끝을 다시 써보려 해’ MV"

    // We only trigger healing if neither is a substring of each other
    if (cleanDb.includes('눈물이있어') || cleanDb.includes('이사람이다')) return true; // specifically flag the known bad ones for sure

    // General check: if the main title part is totally missing
    const parts = dbAnswer.split('-');
    const titlePart = parts.length > 1 ? parts[1].trim().toLowerCase().replace(/\s+/g, '') : cleanDb;

    if (cleanYt.includes(titlePart)) return false; // Contains the title, so it's probably correct

    // Very different!
    return true;
}

async function run() {
    console.log('데이터베이스 자가 치유(Self-Healing) 스크립트 시작...');

    await supabase.auth.signInWithPassword({
        email: 'agent@quizrank.com',
        password: process.env.ADMIN_PASSWORD
    });

    // 1. Fetch only problematic quiz questions (e.g. Cyworld BGM) to speed up execution
    const { data: questions } = await supabase
        .from('quiz_questions')
        .select('*')
        .eq('quiz_id', 'd9ff4d9e-0a9b-49c7-a3db-8d1a7fc32133')
        .not('video_id', 'like', 'http%');

    console.log(`총 ${questions.length}개의 문제를 검증합니다.`);

    let healedCount = 0;

    for (let i = 0; i < questions.length; i++) {
        const q = questions[i];

        // Fast batch check? No, must do sequentially to avoid 429
        try {
            const info = await ytdl.getBasicInfo(q.video_id);
            const ytTitle = info.videoDetails.title;

            if (needsHealing(q.answer, ytTitle)) {
                // Determine a better answer string.  
                let newAnswer = cleanTitle(ytTitle);

                console.log(`[불일치 감지] DB: "${q.answer}" -> 실제 영상: "${ytTitle}"`);
                console.log(` => 변경(Heal): "${newAnswer}"\n`);

                // Update options array
                let newOptions = q.options.map(opt => {
                    if (opt.isCorrect) opt.text = newAnswer;
                    return opt;
                });

                // Update DB
                await supabase.from('quiz_questions').update({
                    answer: newAnswer,
                    options: newOptions
                }).eq('id', q.id);

                healedCount++;
            }
        } catch (err) {
            // Ignore video unavailable errors or skip
        }

        if (i % 20 === 0) console.log(`진행 상황: ${i} / ${questions.length}`);
    }

    console.log(`\n🎉 자가 치유 완료! 총 ${healedCount}개의 잘못된 문제를 유튜브 실제 제목 기반으로 동기화했습니다.`);
}

run();
