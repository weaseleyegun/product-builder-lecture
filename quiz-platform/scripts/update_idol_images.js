const fs = require('fs');
const https = require('https');
const { createClient } = require('@supabase/supabase-js');

const envContent = fs.readFileSync('.dev.vars', 'utf-8');
const supabaseUrl = envContent.match(/SUPABASE_URL="(.*?)"/)[1];
const supabaseKey = envContent.match(/SUPABASE_ANON_KEY="(.*?)"/)[1];
const supabase = createClient(supabaseUrl, supabaseKey);

// Verified working URLs from browser testing
const LEGEND_IMAGES = {
    "카리나 (aespa)": "https://dbkpop.com/wp-content/uploads/2024/10/aespa_Whiplash_MV_Teaser_Karina_2.jpg",
    "윈터 (aespa)": "https://dbkpop.com/wp-content/uploads/2024/10/aespa_Whiplash_MV_Teaser_Winter_4.jpg",
    "장원영 (IVE)": "https://dbkpop.com/wp-content/uploads/2024/04/ive_Switch_concept_wonyoung.jpg",
    "안유진 (IVE)": "https://dbkpop.com/wp-content/uploads/2024/04/ive_Switch_concept_yujin.jpg",
    "해린 (NewJeans)": "https://dbkpop.com/wp-content/uploads/2023/06/NewJeans_Get_Up_Teaser_7.jpg",
    "민지 (NewJeans)": "https://dbkpop.com/wp-content/uploads/2023/06/NewJeans_Get_Up_Teaser_8.jpg",
    "하니 (NewJeans)": "https://dbkpop.com/wp-content/uploads/2023/07/newjeans_get_up_concept_photo_hanni_1.jpg",
    "설윤 (NMIXX)": "https://dbkpop.com/wp-content/uploads/2023/03/nmixx_expergo_concept_photo_sullyoon_1.jpg",
    "제니 (BLACKPINK)": "https://dbkpop.com/wp-content/uploads/2022/08/blackpink_pink_venom_concept_jennie.jpg",
    "지수 (BLACKPINK)": "https://dbkpop.com/wp-content/uploads/2022/09/blackpink_born_pink_concept_photo_jisoo_1.jpg",
    "로제 (BLACKPINK)": "https://dbkpop.com/wp-content/uploads/2022/09/blackpink_born_pink_concept_photo_rose_1.jpg",
    "리사 (BLACKPINK)": "https://dbkpop.com/wp-content/uploads/2022/08/blackpink_pink_venom_concept_lisa.jpg",
    "나연 (TWICE)": "https://dbkpop.com/wp-content/uploads/2024/12/twice_strategy_concept_Nayeon_1.jpg",
    "사나 (TWICE)": "https://dbkpop.com/wp-content/uploads/2024/12/twice_strategy_concept_Sana_1.jpg",
    "모모 (TWICE)": "https://dbkpop.com/wp-content/uploads/2024/12/twice_strategy_concept_Momo_1.jpg",
    "아이린 (Red Velvet)": "https://dbkpop.com/wp-content/uploads/2022/03/red_velvet_the_reve_festival_2022_teaser_Irene_1.jpg",
    "슬기 (Red Velvet)": "https://dbkpop.com/wp-content/uploads/2022/03/red_velvet_the_reve_festival_2022_teaser_Seulgi_1.jpg",
    "슈화 ((G)I-DLE)": "https://dbkpop.com/wp-content/uploads/2023/05/g_i-dle_i_feel_concept_photo_shuhua_1.jpg",
    "미연 ((G)I-DLE)": "https://dbkpop.com/wp-content/uploads/2023/05/g_i-dle_i_feel_concept_photo_miyeon_1.jpg",
    "카즈하 (LE SSERAFIM)": "https://dbkpop.com/wp-content/uploads/2024/08/le_sserafim_crazy_concept_compact_kazuha_1.jpg",
    "김채원 (LE SSERAFIM)": "https://dbkpop.com/wp-content/uploads/2024/08/le_sserafim_crazy_concept_compact_chaewon_1.jpg",
    "사쿠라 (LE SSERAFIM)": "https://dbkpop.com/wp-content/uploads/2024/08/le_sserafim_crazy_concept_compact_sakura_1.jpg",
    "류진 (ITZY)": "https://dbkpop.com/wp-content/uploads/2022/11/itzy_cheshire_concept_photo_ryujin_1.jpg",
    "예지 (ITZY)": "https://dbkpop.com/wp-content/uploads/2022/11/itzy_cheshire_concept_photo_yeji_1.jpg"
};

async function run() {
    console.log("Idol Worldcup Image Update Script Started...");

    await supabase.auth.signInWithPassword({
        email: 'agent@quizrank.com',
        password: 'seed_password_1234!'
    });

    const { data: items, error } = await supabase
        .from('worldcup_items')
        .select('*')
        .eq('worldcup_id', '541ea712-bd3f-445b-8fff-0a3029b035a8');

    if (error) return console.error(error);

    for (let item of items) {
        let newUrl = LEGEND_IMAGES[item.name];

        if (newUrl) {
            console.log(`Updating ${item.name} -> ${newUrl.substring(0, 60)}...`);
            const { error: upErr } = await supabase
                .from('worldcup_items')
                .update({ image_url: newUrl })
                .eq('id', item.id);
            if (upErr) console.error("Update error for", item.name, upErr.message);
        } else {
            console.warn(`No verified URL for ${item.name}. Skipping to keep existing (or avatar).`);
        }
    }
    console.log("Done!");
}

run();
