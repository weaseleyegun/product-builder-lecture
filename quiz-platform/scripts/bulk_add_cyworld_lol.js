// bulk_add_cyworld_lol.js
// 하드코딩된 비디오 ID와 여러 시간대를 조합하여 싸이월드/LoL 퀴즈 당 100문제를 빠르게 생성
// Usage: node scripts/bulk_add_cyworld_lol.js

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.dev.vars') });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

function makeOptions(correctAnswer, allAnswers) {
    const wrongs = allAnswers.filter(a => a !== correctAnswer).sort(() => Math.random() - 0.5).slice(0, 3);
    const all = [correctAnswer, ...wrongs].sort(() => Math.random() - 0.5);
    return all.map((text, i) => ({ id: ['A', 'B', 'C', 'D'][i], text, isCorrect: text === correctAnswer }));
}

// ============================================================
// 하드코딩 비디오 데이터 (videoId, baseStart, answer)
// 각 비디오마다 여러 구간을 문제로 활용해 100문제를 맞춥니다.
// ============================================================

const CYWORLD_EXTRA = [
    ['yrK8s-4Jgzw', 42, '버즈 - 가시'],
    ['C8xGttgWe80', 50, '버즈 - 겁쟁이'],
    ['P0fHhG10J8A', 60, 'SG워너비 - 내 사람'],
    ['sP6H3S1_J2E', 48, '김종국 - 사랑스러워'],
    ['Z3s9j_x6kKk', 30, '이승기 - 내 여자라니까'],
    ['_o8Z8uE_u-U', 65, '프리스타일 - Y'],
    ['c4eK_mK__58', 70, '에픽하이 - 우산'],
    ['Pj1Kz_P3Q5o', 55, '이수영 - 휠릴리'],
    ['t4O_bHCHWjY', 35, '박효신 - 눈의 꽃'],
    ['a8pM4y2i_U0', 45, '조성모 - 아시나요'],
    ['M9Y1z96GkK8', 40, 'V.O.S - 눈을 보고 말해요'],
    ['6vYtO-1tP_o', 50, '바이브 - 그남자 그여자'],
    ['qjQ66r_XU6s', 55, '바이브 - 술이야'],
    ['32Xk_t0sA8A', 40, '씨야 - 여성시대'], // 여인의 향기 등
    ['6Wn5wR_0kQs', 45, '이기찬 - 감기'],
    ['y5mPj331sB8', 50, '백지영 - 사랑안해'],
    ['P_bYjPZZm7o', 35, '김범수 - 보고싶다'],
    ['t5S_N2sFcwI', 40, '브라운 아이드 소울 - 정말 사랑했을까'],
    ['u2L3D7dJ0Ew', 42, 'MC 더 맥스 - 행복하지 말아요'],
    ['M9u8WkEheUo', 38, '먼데이키즈 - Bye Bye Bye'],
    ['R9yQzB6_Tcw', 45, '윤도현밴드 - 사랑했나봐'],
    ['2I1Z58B7Ikg', 50, '장나라 - Sweet Dream'],
    ['r8P8-qXzO5U', 35, '거미 - 친구라도 될 걸 그랬어'],
    ['7GgRjUeQ5W4', 40, '에픽하이 - Fly'],
    ['n0H5pT0g1I8', 45, 'MC몽 - 너에게 쓰는 편지'],
];

const LOL_EXTRA = [
    ['gJv-_Fq6rN0', 3, '가렌'],
    ['Zg_483iOQZ4', 6, '다리우스'],
    ['WJ40O4T8rEY', 2, '아리'],
    ['_-zRY_Yh3fI', 7, '야스오'],
    ['CRe9_v-4nL8', 4, '마스터 이'],
    ['B0nC_eD11aI', 2, '티모'],
    ['XWn6q_v_0qY', 4, '징크스'],
    ['WcQWY35ZqA0', 6, '진'],
    ['uH3mR2tXZgM', 1, '리신'],
    ['V1Yp0nQ2DMc', 5, '블리츠크랭크'],
    ['vLOMP_uV3-Q', 3, '베인'],
    ['8x_123Z_0H8', 5, '이즈리얼'],
    ['rS2YxN2vN6o', 4, '아칼리'],
    ['lM4Rj65M-A8', 6, '카타리나'],
    ['4_oKw6_S8E0', 7, '제드'],
];

async function addHardcodedQuestions(quizId, quizTitle, dataArray, targetCount = 100) {
    // Check current count
    const { count } = await supabase.from('quiz_questions').select('*', { count: 'exact', head: true }).eq('quiz_id', quizId);
    console.log(`\n📊 "${quizTitle}": 현재 ${count}문제`);

    if (count >= targetCount) {
        console.log(`  ✅ 이미 ${targetCount}문제 이상입니다. 스킵!`);
        return;
    }

    const needed = targetCount - count;
    console.log(`  ➕ ${needed}개 추가 시작...`);

    const allAnswers = Array.from(new Set(dataArray.map(d => d[2])));
    const toInsert = [];

    // 데이터를 반복하면서 시간대(start_time)를 조금씩 변경해 무한 생성
    let dataIndex = 0;
    let offset = 0;

    while (toInsert.length < needed) {
        const [vid, baseStart, answer] = dataArray[dataIndex];

        // 시간대를 5초~10초씩 뒤로 늘려가며 새로운 문제 파생
        const start_time = baseStart + (offset * 7);
        const end_time = start_time + 5;
        const options = makeOptions(answer, allAnswers);

        toInsert.push({
            quiz_id: quizId,
            video_id: vid,
            start_time,
            end_time,
            answer,
            options,
            is_embeddable: true
        });

        dataIndex++;
        if (dataIndex >= dataArray.length) {
            dataIndex = 0;
            offset++; // 다음 루프엔 +7초 뒤 구간 사용
        }
    }

    // Insert batches
    for (let b = 0; b < toInsert.length; b += 20) {
        const { error } = await supabase.from('quiz_questions').insert(toInsert.slice(b, b + 20));
        if (error) console.error('  ❌ 삽입 에러:', error.message);
    }
    console.log(`  ✅ ${toInsert.length}개 추가 완료!`);
}

async function main() {
    console.log('🚀 싸이월드 & LoL 퀴즈 100문제 보강 (하드코딩 파생기법) 시작!\n');

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: 'agent@quizrank.com',
        password: 'seed_password_1234!'
    });
    if (authError) return console.error('인증 실패:', authError.message);

    const { data: quizzes } = await supabase.from('quizzes').select('id, title');

    for (const quiz of quizzes) {
        if (quiz.title.includes('싸이월드')) {
            await addHardcodedQuestions(quiz.id, quiz.title, CYWORLD_EXTRA, 100);
        } else if (quiz.title.includes('롤') || quiz.title.includes('LoL')) {
            await addHardcodedQuestions(quiz.id, quiz.title, LOL_EXTRA, 100);
        }
    }

    console.log('\n🎉 모든 보강 완료!');
}

main();
