import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const devVars = fs.readFileSync('.dev.vars', 'utf8');
const config = Object.fromEntries(devVars.split('\n').filter(l => l.includes('=')).map(l => {
    const [k, ...v] = l.split('=');
    return [k, v.join('=').replace(/"/g, '').trim()];
}));

const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);

async function run() {
    // Login
    await supabase.auth.signInWithPassword({
        email: config.ADMIN_EMAIL,
        password: config.ADMIN_PASSWORD
    });

    const { data: items } = await supabase
        .from('worldcup_items')
        .select('id, name, image_url');

    const idolMap = {
        '허윤진': 'https://upload.wikimedia.org/wikipedia/commons/d/d4/260110_Le_Sserafim%27s_Huh_Yunjin_at_GDA_2026_02.jpg',
        '웬디': 'https://upload.wikimedia.org/wikipedia/commons/e/e8/160514_Red_Velvet_WENDY_01.jpg',
        '유진': 'https://upload.wikimedia.org/wikipedia/commons/6/6d/220822_An_Yu-jin_IVE.jpg',
        '가을': 'https://upload.wikimedia.org/wikipedia/commons/0/05/220822_Gaeul_IVE.jpg',
        '원영': 'https://upload.wikimedia.org/wikipedia/commons/3/3a/220824_Jang_Won-young_IVE.jpg',
        '민지': 'https://upload.wikimedia.org/wikipedia/commons/a/a2/230107_NewJeans_Minji.jpg',
        '해린': 'https://upload.wikimedia.org/wikipedia/commons/e/e2/2023_MMA_NewJeans_Haerin_1.jpg',
        '혜인': 'https://upload.wikimedia.org/wikipedia/commons/3/36/230107_NewJeans_Hyein.jpg',
        '다니엘': 'https://upload.wikimedia.org/wikipedia/commons/7/75/NewJeans_Danielle_3.jpg',
        '하니': 'https://upload.wikimedia.org/wikipedia/commons/6/6c/220825_Hanni_NewJeans.jpg',
        '안유진': 'https://upload.wikimedia.org/wikipedia/commons/6/6d/220822_An_Yu-jin_IVE.jpg',
        '레이': 'https://upload.wikimedia.org/wikipedia/commons/9/90/220822_Rei_IVE.jpg',
        '리즈': 'https://upload.wikimedia.org/wikipedia/commons/3/30/220822_Liz_IVE.jpg',
        '이서': 'https://upload.wikimedia.org/wikipedia/commons/7/74/220822_Leeseo_IVE.jpg',
        '백현': 'https://upload.wikimedia.org/wikipedia/commons/0/07/Byun_Baek-hyun_at_a_fansign_in_July_2019.jpg',
        '태연': 'https://upload.wikimedia.org/wikipedia/commons/2/22/Kim_Tae-yeon_at_the_6th_Gaon_Chart_Music_Awards.png',
        '수지': 'https://upload.wikimedia.org/wikipedia/commons/f/f6/Bae_Suzy_at_the_2022_Blue_Dragon_Series_Awards_07.jpg',
        '쯔위': 'https://upload.wikimedia.org/wikipedia/commons/2/27/Chou_Tzu-yu_at_Music_Bank_in_April_2018.jpg',
        '나연': 'https://upload.wikimedia.org/wikipedia/commons/4/4c/Im_Na-yeon_at_Music_Bank_in_April_2018.jpg',
        '카리나': 'https://upload.wikimedia.org/wikipedia/commons/1/18/Aespa%27s_Karina_5.jpg',
        '윈터': 'https://upload.wikimedia.org/wikipedia/commons/a/a2/230527_Winter_at_K-Pop_Concert.jpg',
        '지젤': 'https://upload.wikimedia.org/wikipedia/commons/e/e0/230527_Giselle_at_K-Pop_Concert.jpg',
        '닝닝': 'https://upload.wikimedia.org/wikipedia/commons/1/18/230527_Ningning_at_K-Pop_Concert.jpg',
        '아이린': 'https://upload.wikimedia.org/wikipedia/commons/d/d1/Irene_Bae_at_the_2018_KBS_Song_Festival_01.png',
        '슬기': 'https://upload.wikimedia.org/wikipedia/commons/1/11/Seulgi_Kang_at_the_2018_KBS_Song_Festival_01.png',
        '조이': 'https://upload.wikimedia.org/wikipedia/commons/b/b8/Park_Soo-young_at_the_2018_KBS_Song_Festival_01.png',
        '예리': 'https://upload.wikimedia.org/wikipedia/commons/f/f5/Kim_Ye-rim_at_the_2018_KBS_Song_Festival_01.png',
        '제니': 'https://upload.wikimedia.org/wikipedia/commons/b/b5/Jennie_Kim_for_Vogue_Korea%2C_May_2024.jpg',
        '지수': 'https://upload.wikimedia.org/wikipedia/commons/2/2d/250219_%EB%B8%94%EB%9E%99%ED%95%91%ED%81%AC_%EC%A7%80%EC%88%98_Jisoo.jpg',
        '로제': 'https://upload.wikimedia.org/wikipedia/commons/e/e4/Roseanne_Park_at_Incheon_International_Airport_on_August_25%2C_2023.jpg',
        '리사': 'https://upload.wikimedia.org/wikipedia/commons/a/a2/Lalisa_Manobal_at_Incheon_International_Airport_on_August_25%2C_2023.jpg',
        '사나': 'https://upload.wikimedia.org/wikipedia/commons/2/29/Sana_Minatozaki_2022_%282%29.jpg',
        '모모': 'https://upload.wikimedia.org/wikipedia/commons/0/08/TWICE_MOMO_April_2024.jpg',
        '미나': 'https://upload.wikimedia.org/wikipedia/commons/e/e2/Mina_Myoui_at_Music_Bank_in_April_2018.jpg',
        '정연': 'https://upload.wikimedia.org/wikipedia/commons/f/f6/Yoo_Jeong-yeon_at_Music_Bank_in_April_2018.jpg',
        '지효': 'https://upload.wikimedia.org/wikipedia/commons/f/f8/Park_Ji-hyo_at_Music_Bank_in_April_2018.jpg',
        '채영': 'https://upload.wikimedia.org/wikipedia/commons/1/13/Son_Chae-young_at_Music_Bank_in_April_2018.jpg',
        '다현': 'https://upload.wikimedia.org/wikipedia/commons/0/03/Kim_Da-hyun_at_Music_Bank_in_April_2018.jpg',
        '은채': 'https://upload.wikimedia.org/wikipedia/commons/1/1a/230107_Hong_Eunchae.jpg'
    };

    let count = 0;
    const proxy = 'https://images.weserv.nl/?url=';

    for (const item of items) {
        const cleanName = item.name.split('(')[0].trim().toLowerCase();

        const matchKey = Object.keys(idolMap).find(k => {
            const lowKey = k.toLowerCase();
            return cleanName.includes(lowKey) || lowKey.includes(cleanName);
        });

        if (matchKey) {
            const originalUrl = idolMap[matchKey];
            // Use weserv to resize and center on face (a=top is good for portraits)
            const proxiedUrl = `https://images.weserv.nl/?url=${originalUrl.replace(/^https?:\/\//, '')}&w=1000&fit=cover&a=top`;

            await supabase.from('worldcup_items').update({ image_url: proxiedUrl }).eq('id', item.id);
            console.log(`Updated: ${item.name} -> ${proxiedUrl}`);
            count++;
        }
    }
    console.log(`Done. Updated ${count} items.`);
}

run();
