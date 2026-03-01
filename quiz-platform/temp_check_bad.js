const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const e = fs.readFileSync('.dev.vars', 'utf-8');
const s = createClient(e.match(/SUPABASE_URL="(.*?)"/)[1], e.match(/SUPABASE_ANON_KEY="(.*?)"/)[1]);
async function t() {
    const { data } = await s.from('quiz_questions').select('id, options');
    let badOptions = [];
    data.forEach(q => {
        if (!q.options) return;
        let opts = typeof q.options === 'string' ? JSON.parse(q.options) : q.options;
        opts.forEach(o => {
            if (o.text === 'A' || o.text === 'Ad' || o.text.length < 3) badOptions.push({ id: q.id, opt: o });
        });
    });
    console.log("Bad Options:", badOptions);
}
t();
