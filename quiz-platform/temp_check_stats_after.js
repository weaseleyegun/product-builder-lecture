const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const e = fs.readFileSync('.dev.vars', 'utf-8');
const s = createClient(e.match(/SUPABASE_URL="(.*?)"/)[1], e.match(/SUPABASE_ANON_KEY="(.*?)"/)[1]);

async function check() {
    const { data: q } = await s.from('quizzes').select('*').eq('id', '25ec315a-751e-4f36-b55a-fd64ed809e1e').single();
    if (!q) return console.log("No quiz found");
    console.log("=== AFTER TEST ===");
    console.log(`Quiz ID: ${q.id}`);
    console.log(`Title: ${q.title}`);
    console.log(`play_count: ${q.play_count}`);
    console.log(`game_count: ${q.game_count}`);
    console.log(`correct_count: ${q.correct_count}`);
    console.log(`incorrect_count: ${q.incorrect_count}`);
    console.log(`correct_rate: ${q.correct_rate}`);
}
check();
