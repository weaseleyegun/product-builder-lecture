const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const e = fs.readFileSync('.dev.vars', 'utf-8');
const s = createClient(e.match(/SUPABASE_URL="(.*?)"/)[1], e.match(/SUPABASE_ANON_KEY="(.*?)"/)[1]);

async function run() {
    const { data } = await s.from('quiz_questions').select('id, options');
    let bad = [];
    data.forEach(q => {
        if (!q.options) return;
        let opts = typeof q.options === 'string' ? JSON.parse(q.options) : q.options;
        opts.forEach(o => {
            if (o.text && o.text.length < 3) {
                bad.push({ id: q.id, text: o.text });
            }
        });
    });
    console.log("Total matched:", bad.length);
    let uniqueTexts = [...new Set(bad.map(b => b.text))];
    console.log("Unique short texts:", uniqueTexts);
    if (bad.length > 0) {
        let q = data.find(x => x.id === bad[0].id);
        console.log(q);
    }
}
run();
