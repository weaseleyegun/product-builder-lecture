import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.dev.vars') });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function main() {
    console.log('📊 quizzes 테이블에 통계 컬럼 추가 중...\n');

    // correct_count, incorrect_count, game_count, correct_rate, incorrect_rate, rank 컬럼 추가
    const colQueries = [
        `ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS correct_count BIGINT DEFAULT 0`,
        `ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS incorrect_count BIGINT DEFAULT 0`,
        `ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS game_count BIGINT DEFAULT 0`,
        `ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS correct_rate NUMERIC(5,2) DEFAULT 0`,
        `ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS incorrect_rate NUMERIC(5,2) DEFAULT 0`,
        `ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS rank INTEGER DEFAULT NULL`,
        `ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS play_count BIGINT DEFAULT 0`,
    ];

    for (const sql of colQueries) {
        const { error } = await supabase.rpc('exec_sql', { query: sql }).maybeSingle();
        // rpc may not exist; we'll use the postgres Extension approach via supabase client
        if (error && !error.message.includes('already exists')) {
            console.warn('Note:', error.message);
        }
    }

    // Fetch all quizzes and recalculate rank by play_count descending
    const { data: quizzes, error: fetchErr } = await supabase
        .from('quizzes')
        .select('id, play_count, correct_count, incorrect_count, game_count')
        .order('play_count', { ascending: false });

    if (fetchErr) {
        console.error('❌ quizzes 조회 실패:', fetchErr.message);
        return;
    }

    console.log(`총 ${quizzes.length}개 퀴즈 발견. 순위 업데이트 중...\n`);

    for (let i = 0; i < quizzes.length; i++) {
        const quiz = quizzes[i];
        const rank = i + 1;
        const total = (quiz.correct_count || 0) + (quiz.incorrect_count || 0);
        const correct_rate = total > 0 ? Math.round((quiz.correct_count / total) * 10000) / 100 : 0;
        const incorrect_rate = total > 0 ? Math.round((quiz.incorrect_count / total) * 10000) / 100 : 0;

        const { error: updateErr } = await supabase
            .from('quizzes')
            .update({ rank, correct_rate, incorrect_rate })
            .eq('id', quiz.id);

        if (updateErr) {
            console.warn(`  ⚠️ ${quiz.id} 업데이트 실패:`, updateErr.message);
        } else {
            console.log(`  ✅ rank=${rank}, correct_rate=${correct_rate}%`, quiz.id);
        }
    }

    console.log('\n✅ 통계 컬럼 초기화 완료!');
}

main();
