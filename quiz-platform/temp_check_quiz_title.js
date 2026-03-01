const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const e = fs.readFileSync('.dev.vars', 'utf-8');
const s = createClient(e.match(/SUPABASE_URL="(.*?)"/)[1], e.match(/SUPABASE_ANON_KEY="(.*?)"/)[1]);
async function t() {
    const d = await s.from('quizzes').select('id, title');
    d.data.forEach(q => {
        if (q.title && q.title.includes('62')) console.log(q.title);
    });
}
t();
