const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const e = fs.readFileSync('.dev.vars', 'utf-8');
const s = createClient(e.match(/SUPABASE_URL="(.*?)"/)[1], e.match(/SUPABASE_ANON_KEY="(.*?)"/)[1]);

async function del() {
    const { error } = await s.from('quiz_questions').delete().in('id', [
        'ff5ea816-6d0d-4ae4-90a0-a1114c7ddf70',
        '64117de0-6ca0-4ade-93ca-989ccb5ac27f',
        '33be3dae-bf2c-4b5d-be63-b336dd64bf40'
    ]);
    if (error) console.error(error);
    else console.log("Deleted the exact corrupted options from 우타이테 quiz.");
}
del();
