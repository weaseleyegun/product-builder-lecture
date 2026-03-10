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
        // TWICE
        '나연': 'https://dbkpop.com/wp-content/uploads/2016/11/twice_nayeon_profile.jpg',
        '사나': 'https://dbkpop.com/wp-content/uploads/2016/11/twice_sana_profile.jpg',
        '쯔위': 'https://dbkpop.com/wp-content/uploads/2016/11/twice_tzuyu_profile_eyes_wide_open.jpg',
        '다현': 'https://dbkpop.com/wp-content/uploads/2016/11/Twice_dahyun_profile_moremore.jpg',
        '채영': 'https://dbkpop.com/wp-content/uploads/2016/11/Twice_Chaeyoung_profile_Eyes_wide_open.jpg',
        '지효': 'https://dbkpop.com/wp-content/uploads/2016/11/twice_jihyo_profile-1.jpg',
        '정연': 'https://dbkpop.com/wp-content/uploads/2016/11/twice_jeongyeon_profile.jpg',
        '미나': 'https://dbkpop.com/wp-content/uploads/2016/11/twice_mina_profile.jpg',
        '모모': 'https://dbkpop.com/wp-content/uploads/2016/11/twice_momo_profile.jpg',
        // IVE
        '장원영': 'https://dbkpop.com/wp-content/uploads/2023/10/ive_ive_mine_concept_wonyoung.jpg',
        '안유진': 'https://dbkpop.com/wp-content/uploads/2023/10/ive_ive_mine_concept_yujin.jpg',
        '가을': 'https://dbkpop.com/wp-content/uploads/2023/10/ive_ive_mine_concept_gaeul.jpg',
        '레이': 'https://dbkpop.com/wp-content/uploads/2023/10/ive_ive_mine_concept_rei.jpg',
        '리즈': 'https://dbkpop.com/wp-content/uploads/2023/10/ive_ive_mine_concept_liz.jpg',
        '이서': 'https://dbkpop.com/wp-content/uploads/2023/10/ive_ive_mine_concept_leeseo.jpg',
        // NewJeans
        '민지': 'https://dbkpop.com/wp-content/uploads/2023/04/newjeans_omg_minji_1.jpg',
        '하니': 'https://dbkpop.com/wp-content/uploads/2023/04/newjeans_omg_hanni_1.jpg',
        '다니엘': 'https://dbkpop.com/wp-content/uploads/2023/04/newjeans_omg_danielle_1.jpg',
        '해린': 'https://dbkpop.com/wp-content/uploads/2023/04/newjeans_omg_haerin_1.jpg',
        '혜인': 'https://dbkpop.com/wp-content/uploads/2023/04/newjeans_omg_hyein_1.jpg',
        // aespa
        '카리나': 'https://dbkpop.com/wp-content/uploads/2022/06/aespa_girls_karina_teaser_1.jpg',
        '윈터': 'https://dbkpop.com/wp-content/uploads/2022/06/aespa_girls_winter_teaser_2.jpg',
        '지젤': 'https://dbkpop.com/wp-content/uploads/2022/06/aespa_girls_Giselle_Teaser_1.jpg',
        '닝닝': 'https://dbkpop.com/wp-content/uploads/2022/06/aespa_girls_ningning_teaser_1.jpg',
        // BLACKPINK
        '지수': 'https://dbkpop.com/wp-content/uploads/2018/12/blackpink_Jisoo_profile_the_album.jpg',
        '제니': 'https://dbkpop.com/wp-content/uploads/2018/12/blackpink_jennie_profile.jpg',
        '로제': 'https://dbkpop.com/wp-content/uploads/2018/12/blackpink_Rose_profile_the_album.jpg',
        '리사': 'https://dbkpop.com/wp-content/uploads/2018/12/blackpink_lisa_profile_the_album.jpg',
        // Red Velvet
        '아이린': 'https://dbkpop.com/wp-content/uploads/2017/10/Red_Velvet_Irene_Profile_Queendom.jpg',
        '슬기': 'https://dbkpop.com/wp-content/uploads/2017/10/Red_Velvet_Seulgi_Profile_Queendom.jpg',
        '웬디': 'https://dbkpop.com/wp-content/uploads/2017/10/Red_Velvet_Wendy_profile_Queendom.jpg',
        '조이': 'https://dbkpop.com/wp-content/uploads/2017/10/Red_Velvet_Joy_profile_Queendom.jpg',
        '예리': 'https://dbkpop.com/wp-content/uploads/2017/10/Red_Velvet_Yeri_profile_Queendom.jpg',
        // LE SSERAFIM
        '카즈하': 'https://dbkpop.com/wp-content/uploads/2023/04/le_sserafim_unforgiven_concept_dewy_sage_kazuha_1.jpg',
        '김채원': 'https://dbkpop.com/wp-content/uploads/2023/04/le_sserafim_unforgiven_concept_dewy_sage_chaewon_1.jpg',
        '허윤진': 'https://dbkpop.com/wp-content/uploads/2023/04/le_sserafim_unforgiven_concept_dewy_sage_yunjin_1.jpg',
        '사쿠라': 'https://dbkpop.com/wp-content/uploads/2023/04/le_sserafim_unforgiven_concept_dewy_sage_sakura_1.jpg',
        '홍은채': 'https://dbkpop.com/wp-content/uploads/2023/04/le_sserafim_unforgiven_concept_dewy_sage_eunchae_1.jpg',
        // NMIXX
        '설윤': 'https://dbkpop.com/wp-content/uploads/2022/02/nmixx_sullyoon_profile.jpg',
        // ITZY
        '예지': 'https://dbkpop.com/wp-content/uploads/2019/01/itzy_yeji_profile.jpg',
        '리아': 'https://dbkpop.com/wp-content/uploads/2019/01/itzy_lia_profile.jpg',
        '류진': 'https://dbkpop.com/wp-content/uploads/2019/01/itzy_ryujin_profile.jpg',
        '채령': 'https://dbkpop.com/wp-content/uploads/2019/01/itzy_chaeryeong_profile.jpg',
        '유나': 'https://dbkpop.com/wp-content/uploads/2019/01/itzy_yuna_profile.jpg',
        // (G)I-DLE
        '소연': 'https://dbkpop.com/wp-content/uploads/2018/04/gidle_soyeon_profile-2.jpg',
        '미연': 'https://dbkpop.com/wp-content/uploads/2018/04/gidle_miyeon_profile-1.jpg',
        '민니': 'https://dbkpop.com/wp-content/uploads/2018/04/gidle_minnie_profile-1.jpg',
        '우기': 'https://dbkpop.com/wp-content/uploads/2018/04/gidle_yuqi_profile-1.jpg',
        '슈화': 'https://dbkpop.com/wp-content/uploads/2018/04/gidle_shuhua_profile-1.jpg',
        // STAYC
        '수민': 'https://dbkpop.com/wp-content/uploads/2022/02/stayc_sumin_profile.jpg',
        '시은': 'https://dbkpop.com/wp-content/uploads/2020/10/stayc_sieun_profile.jpg',
        '아이사': 'https://dbkpop.com/wp-content/uploads/2022/02/stayc_Isa_profile.jpg',
        '세은': 'https://dbkpop.com/wp-content/uploads/2022/02/stayc_seeun_profile.jpg',
        '윤': 'https://dbkpop.com/wp-content/uploads/2022/02/Stayc_Yoon_profile.jpg',
        '재이': 'https://dbkpop.com/wp-content/uploads/2022/02/stayc_J_profile.jpg'
    };

    let count = 0;
    for (const item of items) {
        // Normalize: "리사 (BLACKPINK)" -> "리사"
        const cleanName = item.name.split('(')[0].trim().toLowerCase();

        // STRICT MATCHING to avoid "제니쯔" matching "제니"
        const matchKey = Object.keys(idolMap).find(k => k.toLowerCase() === cleanName);

        if (matchKey) {
            const originalUrl = idolMap[matchKey];
            const proxiedUrl = `https://images.weserv.nl/?url=${originalUrl.replace(/^https?:\/\//, '')}&w=1000&fit=cover&a=top`;

            await supabase.from('worldcup_items').update({ image_url: proxiedUrl }).eq('id', item.id);
            console.log(`Updated: ${item.name} -> ${proxiedUrl}`);
            count++;
        }
    }
    console.log(`Done. Updated ${count} items.`);
}

run();
