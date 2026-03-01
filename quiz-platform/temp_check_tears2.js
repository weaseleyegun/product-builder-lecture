const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const e = fs.readFileSync('.dev.vars', 'utf-8');
const s = createClient(e.match(/SUPABASE_URL="(.*?)"/)[1], e.match(/SUPABASE_ANON_KEY="(.*?)"/)[1]);

async function check() {
    const { data } = await s.from('quiz_questions').select('id, answer, options');
    let toFix = [];
    data.forEach(q => {
        let opts = typeof q.options === 'string' ? JSON.parse(q.options) : q.options;
        let answerHasTear = q.answer.includes('눈물');
        let optionsHaveTearIsseo = opts.some(o => o.text.includes('눈물이 있어'));

        if (answerHasTear && optionsHaveTearIsseo) {
            console.log(`Found mismatch! ID: ${q.id}`);
            console.log(`   Answer: ${q.answer}`);
            console.log(`   Options: ${opts.map(o => o.text).join(', ')}`);
        } else if (q.answer === '눈물' || opts.some(o => o.text === '눈물')) {
            console.log(`Found direct 눈물! ID: ${q.id} Answer: ${q.answer}`);
        }
    });
}
check();
