const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const e = fs.readFileSync('.dev.vars', 'utf-8');
const s = createClient(e.match(/SUPABASE_URL="(.*?)"/)[1], e.match(/SUPABASE_ANON_KEY="(.*?)"/)[1]);

const TARGET_QUIZ_ID = '25ec315a-751e-4f36-b55a-fd64ed809e1e';

async function check(label) {
    const { data: q } = await s.from('quizzes').select('*').eq('id', TARGET_QUIZ_ID).single();
    if (!q) return console.log("No quiz found");
    console.log(`=== ${label} ===`);
    console.log(`Quiz ID: ${q.id}`);
    console.log(`Title: ${q.title}`);
    console.log(`play_count (views): ${q.play_count}`);
    console.log(`game_count (completed games): ${q.game_count}`);
    console.log(`correct_count: ${q.correct_count}`);
    console.log(`incorrect_count: ${q.incorrect_count}`);
    console.log(`correct_rate: ${q.correct_rate}%`);
}

if (process.argv[2] === 'after') {
    check('AFTER TEST');
} else {
    check('BEFORE TEST');
}
