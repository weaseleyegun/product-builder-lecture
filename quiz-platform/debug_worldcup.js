const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const e = fs.readFileSync('.dev.vars', 'utf-8');
const s = createClient(e.match(/SUPABASE_URL="(.*?)"/)[1], e.match(/SUPABASE_ANON_KEY="(.*?)"/)[1]);

async function run() {
    const { data } = await s.from('worldcup_items').select('name, image_url').eq('worldcup_id', '541ea712-bd3f-445b-8fff-0a3029b035a8');
    console.log(JSON.stringify(data, null, 2));
}
run();
