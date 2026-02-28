// add_questions_to_existing_quizzes.js
// 기존 퀴즈에 문제를 100개 이상으로 보충하는 스크립트
// Usage: node scripts/add_questions_to_existing_quizzes.js

import { createClient } from '@supabase/supabase-js';
import ytsr from 'ytsr';
import dotenv from 'dotenv';
import path from 'path';

import { JPOP_SONGS } from './seed_data/jpop.js';
import { POP_SONGS } from './seed_data/pop.js';
import { ANIME_SONGS } from './seed_data/anime.js';
import { GAME_SONGS } from './seed_data/game.js';
import { KPOP_SONGS } from './seed_data/kpop.js';
import { UTAITE_SONGS } from './seed_data/utaite.js';

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
            await delay(300);
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
    start = Math.max(10, Math.min(start, totalSec - 15));
    return { start, end: start + 5 };
}

function makeOptions(correctAnswer, allAnswers) {
    const wrongs = allAnswers.filter(a => a !== correctAnswer).sort(() => Math.random() - 0.5).slice(0, 3);
    const all = [correctAnswer, ...wrongs].sort(() => Math.random() - 0.5);
    return all.map((text, i) => ({ id: ['A', 'B', 'C', 'D'][i], text, isCorrect: text === correctAnswer }));
}

// Fetch existing question IDs (to avoid duplicates by video_id in same quiz)
async function getExistingVideoIds(quizId) {
    const { data } = await supabase
        .from('quiz_questions')
        .select('video_id')
        .eq('quiz_id', quizId);
    return new Set((data || []).map(q => q.video_id));
}

async function addQuestionsToQuiz(quizId, quizTitle, songs, targetCount = 100) {
    const existingIds = await getExistingVideoIds(quizId);
    const currentCount = existingIds.size;

    console.log(`\n📊 "${quizTitle}": 현재 ${currentCount}문제 → 목표 ${targetCount}문제`);

    if (currentCount >= targetCount) {
        console.log(`  ✅ 이미 ${currentCount}개! 스킵합니다.`);
        return;
    }

    const needed = targetCount - currentCount;
    console.log(`  ➕ ${needed}개 문제를 추가합니다...\n`);

    const allAnswers = songs.map(s => s[1]);
    const questionsToInsert = [];
    let failCount = 0;

    // Shuffle songs so we don't always start from the beginning
    const shuffledSongs = songs.slice().sort(() => Math.random() - 0.5);

    for (const [searchQuery, correctAnswer] of shuffledSongs) {
        if (questionsToInsert.length >= needed) break;

        process.stdout.write(`  [${questionsToInsert.length + 1}/${needed}] ${correctAnswer} ... `);
        const video = await findEmbeddableVideo(searchQuery);

        if (!video || existingIds.has(video.id)) {
            if (!video) {
                console.log('❌ 임베드 불가');
            } else {
                console.log('⏭️ 중복 스킵');
            }
            failCount++;
            await delay(500);
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
        console.log('  ⚠️ 추가할 문제가 없습니다.');
        return;
    }

    // Insert in batches of 20
    for (let b = 0; b < questionsToInsert.length; b += 20) {
        const batch = questionsToInsert.slice(b, b + 20);
        const { error } = await supabase.from('quiz_questions').insert(batch);
        if (error) console.error('  ❌ 배치 삽입 실패:', error.message);
    }

    console.log(`\n  ✅ 완료! ${questionsToInsert.length}개 추가 (실패: ${failCount})`);
}

async function main() {
    console.log('🚀 기존 퀴즈 문제 100개 이상 보충 시작!\n');

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: 'agent@quizrank.com',
        password: 'seed_password_1234!'
    });

    if (authError || !authData.user) {
        console.error('❌ 인증 실패:', authError?.message);
        return;
    }
    console.log('✅ 인증 완료\n');

    // Fetch all quizzes from DB
    const { data: quizzes, error } = await supabase
        .from('quizzes')
        .select('id, title')
        .order('created_at', { ascending: true });

    if (error) { console.error('퀴즈 목록 조회 실패:', error.message); return; }

    console.log(`총 ${quizzes.length}개 퀴즈 발견:\n`);
    quizzes.forEach((q, i) => console.log(`  ${i + 1}. ${q.title} (${q.id})`));

    // Map quiz titles to their seed data
    const categoryMap = [
        { keyword: 'J-POP', songs: JPOP_SONGS },
        { keyword: 'K-POP', songs: KPOP_SONGS },
        { keyword: '빌보드', songs: POP_SONGS },
        { keyword: '애니메이션', songs: ANIME_SONGS },
        { keyword: '게임', songs: GAME_SONGS },
        { keyword: '우타이테', songs: UTAITE_SONGS },
    ];

    for (const quiz of quizzes) {
        const match = categoryMap.find(c => quiz.title.includes(c.keyword));
        if (!match) {
            console.log(`\n⏭️ "${quiz.title}" - 시딩 데이터 없음, 스킵`);
            continue;
        }
        await addQuestionsToQuiz(quiz.id, quiz.title, match.songs, 100);
        await delay(2000);
    }

    console.log('\n🎉 모든 퀴즈 문제 보충 완료!');
}

main();
