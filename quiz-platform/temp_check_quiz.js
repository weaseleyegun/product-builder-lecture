const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const e = fs.readFileSync('.dev.vars', 'utf-8');
const s = createClient(e.match(/SUPABASE_URL="(.*?)"/)[1], e.match(/SUPABASE_ANON_KEY="(.*?)"/)[1]);
async function t() {
    const d = await s.from('quiz_questions').select('quiz_id, options, answer').eq('id', '6949d672-1304-40d0-8fba-27a264dc0fac');
    console.log(JSON.stringify(d.data, null, 2));
}
t();
