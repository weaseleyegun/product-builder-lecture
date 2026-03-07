import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const devVars = fs.readFileSync('.dev.vars', 'utf8');
const config = Object.fromEntries(devVars.split('\n').filter(l => l.includes('=')).map(l => {
    const [k, ...v] = l.split('=');
    return [k, v.join('=').replace(/"/g, '').trim()];
}));

const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);

const imageMap = {
    // Café Beverages
    '아메리카노': 'https://images.unsplash.com/photo-1551033406-611cf9a28f67?auto=format&fit=crop&q=80&w=500',
    '아메': 'https://images.unsplash.com/photo-1551033406-611cf9a28f67?auto=format&fit=crop&q=80&w=500',
    '콜드브루': 'https://images.unsplash.com/photo-1517701604599-bb28b3650422?auto=format&fit=crop&q=80&w=500',
    '콜드': 'https://images.unsplash.com/photo-1517701604599-bb28b3650422?auto=format&fit=crop&q=80&w=500',
    '카페라떼': 'https://images.unsplash.com/photo-1595434066389-99c3149ca692?auto=format&fit=crop&q=80&w=500',
    '라떼': 'https://images.unsplash.com/photo-1595434066389-99c3149ca692?auto=format&fit=crop&q=80&w=500',
    '카푸치노': 'https://images.unsplash.com/photo-1534778101976-62847782c213?auto=format&fit=crop&q=80&w=500',
    '카페모카': 'https://images.unsplash.com/photo-1578314675249-a6910f80cc4e?auto=format&fit=crop&q=80&w=500',
    '마끼아또': 'https://images.unsplash.com/photo-1485182708500-e8f1f318ba72?auto=format&fit=crop&q=80&w=500',
    '레몬에이드': 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&q=80&w=500',
    '자몽 에이드': 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&q=80&w=500',
    '밀크티': 'https://images.unsplash.com/photo-1542729779-11d8fe8e25f6?auto=format&fit=crop&q=80&w=500',
    '핫초코': 'https://images.unsplash.com/photo-1544787210-2213d64ad992?auto=format&fit=crop&q=80&w=500',

    // Korean Food
    '김치찌개': 'https://images.unsplash.com/photo-1583213048567-33678564a937?auto=format&fit=crop&q=80&w=500',
    '김치': 'https://images.unsplash.com/photo-1583213048567-33678564a937?auto=format&fit=crop&q=80&w=500',
    '불고기': 'https://images.unsplash.com/photo-1635102479037-1c3971bb0b7b?auto=format&fit=crop&q=80&w=500',
    '비빔밥': 'https://images.unsplash.com/photo-1590301157890-4810ed352733?auto=format&fit=crop&q=80&w=500',
    '떡볶이': 'https://images.unsplash.com/photo-1623653387945-2fd25214f8fc?auto=format&fit=crop&q=80&w=500',
    '치킨': 'https://images.unsplash.com/photo-1562967914-6cbb04bac381?auto=format&fit=crop&q=80&w=500',
    '삼겹살': 'https://images.unsplash.com/photo-1544124499-58b62ec0a905?auto=format&fit=crop&q=80&w=500',
    '짜장면': 'https://images.unsplash.com/photo-1658483661380-469f37c2205c?auto=format&fit=crop&q=80&w=500',
    '짬뽕': 'https://images.unsplash.com/photo-1617093727343-374698b1b08d?auto=format&fit=crop&q=80&w=500',
    '돈까스': 'https://images.unsplash.com/photo-1598511757337-fe29c317a52c?auto=format&fit=crop&q=80&w=500',
    '라멘': 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&q=80&w=500',
    '스시': 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&q=80&w=500',
    '초밥': 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&q=80&w=500',
    '냉면': 'https://images.unsplash.com/photo-1606787366850-de6330128bfc?auto=format&fit=crop&q=80&w=500',

    // Anime (Generic/Popular)
    '나루토': 'https://cdn.myanimelist.net/images/anime/13/17405.jpg',
    '사스케': 'https://cdn.myanimelist.net/images/characters/9/131317.jpg',
    '카카시': 'https://cdn.myanimelist.net/images/characters/7/284129.jpg',
    '루피': 'https://cdn.myanimelist.net/images/characters/9/310307.jpg',
    '조로': 'https://cdn.myanimelist.net/images/characters/3/100534.jpg',
    '상디': 'https://cdn.myanimelist.net/images/characters/5/136769.jpg',
    '고쿠': 'https://cdn.myanimelist.net/images/characters/11/328222.jpg',
    '에드워드 엘릭': 'https://cdn.myanimelist.net/images/characters/9/72533.jpg',
    '리바이': 'https://cdn.myanimelist.net/images/characters/2/241413.jpg',
    '엘런': 'https://cdn.myanimelist.net/images/characters/10/216841.jpg',
    '미카사': 'https://cdn.myanimelist.net/images/characters/9/215513.jpg',

    // Idols
    '윈터': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/220524_Winter_aespa.jpg/640px-220524_Winter_aespa.jpg',
    '사나': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/220826_Sana_Twice.jpg/640px-220826_Sana_Twice.jpg',
    '카리나': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/220524_Karina_aespa.jpg/640px-220524_Karina_aespa.jpg',
    '장원영': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/220824_Jang_Won-young_IVE.jpg/640px-220824_Jang_Won-young_IVE.jpg',
    '하니': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6c/220825_Hanni_NewJeans.jpg/640px-220825_Hanni_NewJeans.jpg',
    '설윤': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/220930_Sullyoon_NMIXX.jpg/640px-220930_Sullyoon_NMIXX.jpg',
    '슬기': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Seulgi_at_The_Reve_Festival_Finale_Album_Fansign_on_January_4%2C_2020.jpg/640px-Seulgi_at_The_Reve_Festival_Finale_Album_Fansign_on_January_4%2C_2020.jpg',
    '해린': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/70/220825_Haerin_NewJeans.jpg/640px-220825_Haerin_NewJeans.jpg',
    '민지': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/220825_Minji_NewJeans.jpg/640px-220825_Minji_NewJeans.jpg',
    '모모': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/220826_Momo_Twice.jpg/640px-220826_Momo_Twice.jpg',
    '지수': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/53/Blackpink_Jisoo_Adidas_2021.jpg/640px-Blackpink_Jisoo_Adidas_2021.jpg'
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

    const { data: items, error: fetchError } = await supabase
        .from('worldcup_items')
        .select('id, name, image_url');

    if (fetchError) {
        console.error('Fetch Error:', fetchError.message);
        return;
    }

    let updatedCount = 0;
    for (const item of items) {
        // Normalize: remove everything in brackets, e.g., "모모 (TWICE)" -> "모모"
        const cleanName = item.name.split('(')[0].trim().toLowerCase();

        const matchKey = Object.keys(imageMap).find(k => {
            const key = k.toLowerCase();
            return cleanName.includes(key) || key.includes(cleanName);
        });

        if (matchKey) {
            const newUrl = imageMap[matchKey];
            const { error: updateError } = await supabase
                .from('worldcup_items')
                .update({ image_url: newUrl })
                .eq('id', item.id);

            if (!updateError) {
                console.log(`Updated [${item.name}] with [${newUrl}]`);
                updatedCount++;
            }
        }
    }

    console.log(`\n✅ Finished. Total items updated: ${updatedCount}`);
}

run();
