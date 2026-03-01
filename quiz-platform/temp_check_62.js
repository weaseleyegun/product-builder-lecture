const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const e = fs.readFileSync('.dev.vars', 'utf-8');
const s = createClient(e.match(/SUPABASE_URL="(.*?)"/)[1], e.match(/SUPABASE_ANON_KEY="(.*?)"/)[1]);
async function t() {
    const { data } = await s.from('quizzes').select('id, title').like('title', '%우타이테%').single();
    if (data) {
        const d = await s.from('quiz_questions').select('options').eq('quiz_id', data.id);
        if (d.data.length >= 62) {
            console.log(JSON.stringify(d.data[61].options, null, 2));
        } else {
            console.log("length:", d.data.length);
        }
    }
}
t();
