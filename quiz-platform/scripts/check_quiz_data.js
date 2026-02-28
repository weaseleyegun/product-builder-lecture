import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.dev.vars') });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function checkQuizData() {
    const { data: quizzes, error } = await supabase.from('quizzes').select('id, title').order('created_at');
    if (error) {
        console.error('Error fetching quizzes:', error);
        return;
    }

    console.log(`총 ${quizzes.length}개의 퀴즈가 있습니다.\n`);

    for (const quiz of quizzes) {
        const { count } = await supabase
            .from('quiz_questions')
            .select('*', { count: 'exact', head: true })
            .eq('quiz_id', quiz.id);

        console.log(`- [${quiz.id}] ${quiz.title}: ${count}문제`);
    }
}

checkQuizData();
