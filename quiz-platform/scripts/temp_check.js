import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const devVars = fs.readFileSync('.dev.vars', 'utf8');
const config = Object.fromEntries(devVars.split('\n').filter(l => l.includes('=')).map(l => {
    const [k, ...v] = l.split('=');
    return [k, v.join('=').replace(/"/g, '').trim()];
}));

const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);

async function run() {
    const { data: worldcups, error } = await supabase
        .from('worldcups')
        .select('title, play_count')
        .order('play_count', { ascending: false });

    if (error) {
        console.error('Error fetching worldcups:', error.message);
        return;
    }

    console.log('Worldcups sorted by play_count:');
    worldcups.forEach(wc => {
        console.log(`- ${wc.title}: ${wc.play_count}`);
    });
}
run();
