import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

// Load from .dev.vars manually since it's not standard .env format
const devVars = fs.readFileSync('.dev.vars', 'utf8');
const config = Object.fromEntries(devVars.split('\n').filter(l => l.includes('=')).map(l => {
    const [k, ...v] = l.split('=');
    return [k, v.join('=').replace(/"/g, '')];
}));

const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);

async function listItems() {
    // Login as admin
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: config.ADMIN_EMAIL,
        password: config.ADMIN_PASSWORD
    });

    if (authError) {
        console.error('Auth Error:', authError.message);
        return;
    }

    const { data: worldcups, error: wcError } = await supabase
        .from('worldcups')
        .select('id, title')
        .order('play_count', { ascending: false });

    if (wcError) {
        console.error('WC Error:', wcError.message);
        return;
    }

    console.log(`Found ${worldcups.length} worldcups. Checking items...`);

    for (const wc of worldcups) {
        const { data: items, error: itemError } = await supabase
            .from('worldcup_items')
            .select('id, name, image_url')
            .eq('worldcup_id', wc.id);

        if (itemError) continue;

        const needsFix = items.filter(i => !i.image_url || i.image_url.includes('placeholder') || i.image_url.length < 5);
        if (needsFix.length > 0) {
            console.log(`WC [${wc.title}] needs ${needsFix.length} fixes.`);
            needsFix.forEach(i => console.log(`  - ${i.name}`));
        }
    }
}

listItems();
