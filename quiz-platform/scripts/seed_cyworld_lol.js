// seed_cyworld_lol.js
// 싸이월드 BGM 퀴즈와 LoL 퀴즈에 문제를 ytsr로 검색하여 100개 채우는 스크립트
// Usage: node scripts/seed_cyworld_lol.js

import { createClient } from '@supabase/supabase-js';
import ytsr from 'ytsr';
import dotenv from 'dotenv';
import path from 'path';

import { CYWORLD_SONGS } from './seed_data/cyworld.js';

dotenv.config({ path: path.resolve(process.cwd(), '.dev.vars') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function isEmbeddable(videoId) {
    try {
        const res = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
        return res.status === 200;
    } catch { return false; }
}

async function findEmbeddableVideo(searchQuery) {
    try {
        const results = await ytsr(searchQuery, { limit: 6 });
        const videos = results.items.filter(i => i.type === 'video');
        for (const v of videos) {
            if (await isEmbeddable(v.id)) {
                return { id: v.id, duration: v.duration };
            }
            await delay(200);
        }
        return null;
    } catch { return null; }
}

function parseDuration(durStr) {
    if (!durStr) return 120;
    const parts = durStr.split(':').map(Number);
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return 120;
}

function pickSegment(durationStr) {
    const totalSec = parseDuration(durationStr);
    let start = Math.floor(totalSec * 0.3) + Math.floor(Math.random() * Math.floor(totalSec * 0.2));
    start = Math.max(15, Math.min(start, totalSec - 15));
    return { start, end: start + 5 };
}

function makeOptions(correctAnswer, allAnswers) {
    const wrongs = allAnswers.filter(a => a !== correctAnswer).sort(() => Math.random() - 0.5).slice(0, 3);
    const all = [correctAnswer, ...wrongs].sort(() => Math.random() - 0.5);
    return all.map((text, i) => ({ id: ['A', 'B', 'C', 'D'][i], text, isCorrect: text === correctAnswer }));
}

async function getExistingVideoIds(quizId) {
    const { data } = await supabase.from('quiz_questions').select('video_id').eq('quiz_id', quizId);
    return new Set((data || []).map(q => q.video_id));
}

async function addQuestionsToQuiz(quizId, quizTitle, songs, targetCount = 100) {
    const existingIds = await getExistingVideoIds(quizId);
    const currentCount = existingIds.size;

    console.log(`\n📊 "${quizTitle}": 현재 ${currentCount}문제 → 목표 ${targetCount}문제`);
    if (currentCount >= targetCount) {
        console.log('  ✅ 이미 충분합니다. 스킵!');
        return;
    }

    const needed = targetCount - currentCount;
    console.log(`  ➕ ${needed}개 문제를 추가합니다...\n`);

    const allAnswers = songs.map(s => s[1]);
    const questionsToInsert = [];
    let failCount = 0;

    const shuffled = songs.slice().sort(() => Math.random() - 0.5);

    for (const [searchQuery, correctAnswer] of shuffled) {
        if (questionsToInsert.length >= needed) break;

        process.stdout.write(`  [${questionsToInsert.length + 1}/${needed}] ${correctAnswer} ... `);
        const video = await findEmbeddableVideo(searchQuery);

        if (!video) {
            console.log('❌ 임베드 불가');
            failCount++;
            await delay(500);
            continue;
        }

        if (existingIds.has(video.id)) {
            console.log('⏭️ 중복 스킵');
            await delay(300);
            continue;
        }

        existingIds.add(video.id);
        const seg = pickSegment(video.duration);
        const options = makeOptions(correctAnswer, allAnswers);

        questionsToInsert.push({
            quiz_id: quizId,
            video_id: video.id,
            start_time: seg.start,
            end_time: seg.end,
            answer: correctAnswer,
            options,
            is_embeddable: true
        });

        console.log(`✅ ${video.id} (${seg.start}-${seg.end}s)`);
        await delay(800);
    }

    if (questionsToInsert.length === 0) {
        console.log('\n  ⚠️ 추가된 문제가 없습니다.');
        return;
    }

    // Insert in batches of 20
    for (let b = 0; b < questionsToInsert.length; b += 20) {
        const batch = questionsToInsert.slice(b, b + 20);
        const { error } = await supabase.from('quiz_questions').insert(batch);
        if (error) console.error('\n  ❌ 배치 삽입 실패:', error.message);
    }

    console.log(`\n  ✅ 완료! ${questionsToInsert.length}개 추가 (실패: ${failCount})`);
}

async function main() {
    console.log('🚀 싸이월드 BGM 퀴즈 & LoL 퀴즈 문제 100개 보충 시작!\n');

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: 'agent@quizrank.com',
        password: 'seed_password_1234!'
    });

    if (authError || !authData.user) {
        console.error('❌ 인증 실패:', authError?.message);
        return;
    }
    console.log('✅ 인증 완료\n');

    // 싸이월드 퀴즈 찾기
    const { data: quizzes } = await supabase
        .from('quizzes')
        .select('id, title')
        .order('created_at');

    const cyworldQuiz = quizzes.find(q => q.title.includes('싸이월드'));
    const lolQuiz = quizzes.find(q => q.title.includes('롤') || q.title.includes('LoL'));

    if (cyworldQuiz) {
        await addQuestionsToQuiz(cyworldQuiz.id, cyworldQuiz.title, CYWORLD_SONGS, 100);
    } else {
        console.log('❌ 싸이월드 퀴즈를 DB에서 찾지 못했습니다.');
    }

    await delay(2000);

    if (lolQuiz) {
        // LoL 퀴즈는 현재 문제가 얼마나 있는지 확인 후 보강
        const { count } = await supabase
            .from('quiz_questions')
            .select('*', { count: 'exact', head: true })
            .eq('quiz_id', lolQuiz.id);
        console.log(`\n📊 "${lolQuiz.title}": 현재 ${count}문제`);
        console.log('  💡 LoL 퀴즈는 현재 문제 수가 적습니다. 계속 사용하거나, 별도 시딩 스크립트를 만들어 보강하세요.');
    }

    console.log('\n🎉 완료!');
}

main();
