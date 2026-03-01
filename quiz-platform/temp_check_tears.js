const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const e = fs.readFileSync('.dev.vars', 'utf-8');
const s = createClient(e.match(/SUPABASE_URL="(.*?)"/)[1], e.match(/SUPABASE_ANON_KEY="(.*?)"/)[1]);

async function check() {
    const { data } = await s.from('quiz_questions').select('id, answer, options').like('answer', '%눈물%');
    data.forEach(q => {
        let opts = typeof q.options === 'string' ? JSON.parse(q.options) : q.options;
        console.log(`Answer: ${q.answer}`);
        console.log(`Options: ${opts.map(o => o.text).join(', ')}`);
    });
}
check();
