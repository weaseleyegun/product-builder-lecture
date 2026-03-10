import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const devVars = fs.readFileSync('.dev.vars', 'utf8');
const config = Object.fromEntries(devVars.split('\n').filter(l => l.includes('=')).map(l => {
    const [k, ...v] = l.split('=');
    return [k, v.join('=').replace(/"/g, '').trim()];
}));

const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);

async function run() {
    const { data, error } = await supabase
        .from('worldcups')
        .select('*')
        .limit(1);

    if (error) {
        console.error(error);
        return;
    }

    console.log('Columns in worldcups:', Object.keys(data[0] || {}));
}
run();
