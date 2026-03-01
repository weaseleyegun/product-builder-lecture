const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const e = fs.readFileSync('.dev.vars', 'utf-8');
const s = createClient(e.match(/SUPABASE_URL="(.*?)"/)[1], e.match(/SUPABASE_ANON_KEY="(.*?)"/)[1]);
async function t() {
    const { data } = await s.from('quiz_questions').select('id, options').eq('quiz_id', 'ec106977-1459-4772-9c33-4c942792d71e');
    let matches = [];
    data.forEach(q => {
        if (!q.options) return;
        let opts = typeof q.options === 'string' ? JSON.parse(q.options) : q.options;
        // Check if options have short texts
        let texts = opts.map(o => o.text.trim());
        let hasAd = texts.some(t => t.startsWith('Ad'));
        let hasA = texts.some(t => t.startsWith('A') && t.length < 5);
        if (hasAd) {
            matches.push({ id: q.id, texts });
        }
    });
    console.log(JSON.stringify(matches, null, 2));
}
t();
