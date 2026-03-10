import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const devVars = fs.readFileSync('.dev.vars', 'utf8');
const config = Object.fromEntries(devVars.split('\n').filter(l => l.includes('=')).map(l => {
    const [k, ...v] = l.split('=');
    return [k, v.join('=').replace(/"/g, '').trim()];
}));

const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);

const imageMap = {
    '아메리카노': 'https://images.unsplash.com/photo-1551033406-611cf9a28f67?auto=format&fit=crop&q=80&w=500',
    '아메': 'https://images.unsplash.com/photo-1551033406-611cf9a28f67?auto=format&fit=crop&q=80&w=500',
    '콜드브루': 'https://images.unsplash.com/photo-1517701604599-bb28b3650422?auto=format&fit=crop&q=80&w=500',
    '콜드': 'https://images.unsplash.com/photo-1517701604599-bb28b3650422?auto=format&fit=crop&q=80&w=500',
    '카페라떼': 'https://images.unsplash.com/photo-1595434066389-99c3149ca692?auto=format&fit=crop&q=80&w=500',
    '라떼': 'https://images.unsplash.com/photo-1595434066389-99c3149ca692?auto=format&fit=crop&q=80&w=500',
    '카푸치노': 'https://images.unsplash.com/photo-1534778101976-62847782c213?auto=format&fit=crop&q=80&w=500',
    '에스프레소': 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?auto=format&fit=crop&q=80&w=500',
    '카페모카': 'https://images.unsplash.com/photo-1578314675249-a6910f80cc4e?auto=format&fit=crop&q=80&w=500',
    '모카': 'https://images.unsplash.com/photo-1578314675249-a6910f80cc4e?auto=format&fit=crop&q=80&w=500',
    '카라멜 마끼아또': 'https://images.unsplash.com/photo-1485182708500-e8f1f318ba72?auto=format&fit=crop&q=80&w=500',
    '마끼아또': 'https://images.unsplash.com/photo-1485182708500-e8f1f318ba72?auto=format&fit=crop&q=80&w=500',
    '아포가토': 'https://images.unsplash.com/photo-1594438092306-c1766bddbb2a?auto=format&fit=crop&q=80&w=500',
    '레몬에이드': 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&q=80&w=500',
    '자몽 에이드': 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&q=80&w=500',
    '자몽에이드': 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&q=80&w=500',
    '유자차': 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&q=80&w=500',
    '밀크티': 'https://images.unsplash.com/photo-1542729779-11d8fe8e25f6?auto=format&fit=crop&q=80&w=500',
    '버블티': 'https://images.unsplash.com/photo-1542729779-11d8fe8e25f6?auto=format&fit=crop&q=80&w=500',
    '플랫 화이트': 'https://images.unsplash.com/photo-1536964541575-cf10836528d2?auto=format&fit=crop&q=80&w=500',
    '플랫화이트': 'https://images.unsplash.com/photo-1536964541575-cf10836528d2?auto=format&fit=crop&q=80&w=500',
    '핫초코': 'https://images.unsplash.com/photo-1544787210-2213d64ad992?auto=format&fit=crop&q=80&w=500',
    '초코라떼': 'https://images.unsplash.com/photo-1544787210-2213d64ad992?auto=format&fit=crop&q=80&w=500'
};

async function run() {
    // Login
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: config.ADMIN_EMAIL,
        password: config.ADMIN_PASSWORD
    });

    if (authError) {
        console.error('Auth Error:', authError.message);
        return;
    }

    console.log('Logged in as admin.');

    // Update items based on current names
    const { data: items, error: fetchError } = await supabase
        .from('worldcup_items')
        .select('id, name, image_url');

    if (fetchError) {
        console.error('Fetch Error:', fetchError.message);
        return;
    }

    let updatedCount = 0;
    for (const item of items) {
        // Find best match in imageMap
        const match = Object.keys(imageMap).find(k => item.name.includes(k));
        if (match) {
            const newUrl = imageMap[match];
            // Only update if it's currently a placeholder or empty
            if (!item.image_url || item.image_url.includes('placehold.jp') || item.image_url.includes('i.imgur.com/rNhHLCn')) {
                const { error: updateError } = await supabase
                    .from('worldcup_items')
                    .update({ image_url: newUrl })
                    .eq('id', item.id);

                if (!updateError) {
                    console.log(`Updated [${item.name}] with [${newUrl}]`);
                    updatedCount++;
                } else {
                    console.error(`Failed to update [${item.name}]:`, updateError.message);
                }
            }
        }
    }

    console.log(`Successfully updated ${updatedCount} items.`);
}

run();
