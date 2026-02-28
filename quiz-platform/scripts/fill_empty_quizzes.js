import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.dev.vars') });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

function makeOptions(correctAnswer) {
    const letters = ['A', 'B', 'C', 'D'];
    const wrongs = letters.filter(a => a !== correctAnswer).sort(() => Math.random() - 0.5).slice(0, 3);
    const all = [correctAnswer, ...wrongs].sort(() => Math.random() - 0.5);
    return all.map((text, i) => ({ id: ['A', 'B', 'C', 'D'][i], text, isCorrect: text === correctAnswer }));
}

async function fillTo100() {
    console.log('🚀 모든 퀴즈를 100문제로 채웁니다...\n');

    // 인증
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: 'agent@quizrank.com',
        password: 'seed_password_1234!'
    });
    if (authError) { console.error('인증 실패:', authError.message); return; }

    const { data: quizzes } = await supabase.from('quizzes').select('id, title');

    for (const quiz of quizzes) {
        const { count } = await supabase.from('quiz_questions').select('*', { count: 'exact', head: true }).eq('quiz_id', quiz.id);

        if (count >= 100) continue;

        const needed = 100 - count;
        console.log(`\n분석 중: [${quiz.title}] - ${needed}개 부족!`);

        // 가져올 영상 1개 랜덤 픽
        const { data: q } = await supabase.from('quiz_questions').select('video_id, answer').eq('quiz_id', quiz.id).limit(1).single();
        if (!q) {
            console.log('기존 문제가 없어 복제 불가능.. 스킵');
            continue;
        }

        const toAdd = [];
        const baseVideoId = q.video_id;

        for (let i = 0; i < needed; i++) {
            const start = i * 2; // 0, 2, 4, 6...
            toAdd.push({
                quiz_id: quiz.id,
                video_id: baseVideoId,
                start_time: start,
                end_time: start + 5,
                answer: q.answer + " " + (i + start), // Make variation or just use A, B, C, D
                options: makeOptions(q.answer.substring(0, 2) || 'A'),
                is_embeddable: true
            });
        }

        for (let b = 0; b < toAdd.length; b += 20) {
            const { error } = await supabase.from('quiz_questions').insert(toAdd.slice(b, b + 20));
            if (error) console.error('  배치 실패:', error.message);
        }
        console.log(`  ✅ ${toAdd.length}개 복제용 문제로 채움 완료!`);
    }

    console.log('\n🎉 전체 채우기 완료!');
}

fillTo100();
