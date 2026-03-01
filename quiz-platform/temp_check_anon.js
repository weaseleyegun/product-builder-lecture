const { createClient } = require('@supabase/supabase-js');
const fs = require('fs'); const e = fs.readFileSync('.dev.vars', 'utf-8');
const supabase = createClient(e.match(/SUPABASE_URL="(.*?)"/)[1], e.match(/SUPABASE_ANON_KEY="(.*?)"/)[1]);

async function check() {
    const r1 = await supabase.from('quizzes').update({ play_count: 5 }).eq('id', '25ec315a-751e-4f36-b55a-fd64ed809e1e').select();
    console.log("UPDATE using ANON Key:", r1);

    // Check RPC
    const r2 = await supabase.rpc('increment_play_count', { quiz_id: '25ec315a-751e-4f36-b55a-fd64ed809e1e' });
    console.log("RPC increment_play_count:", r2);
}
check();
