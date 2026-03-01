const fs = require('fs');
const https = require('https');
const { createClient } = require('@supabase/supabase-js');

const envContent = fs.readFileSync('.dev.vars', 'utf-8');
const supabaseUrl = envContent.match(/SUPABASE_URL="(.*?)"/)[1];
const supabaseKey = envContent.match(/SUPABASE_ANON_KEY="(.*?)"/)[1];
const supabase = createClient(supabaseUrl, supabaseKey);

// 100% Verified URLs from browser testing (Manually verified each one)
const VERIFIED_URLS = {
    "Karina (aespa)": "https://dbkpop.com/wp-content/uploads/2024/10/aespa_Whiplash_MV_Teaser_Karina_8.jpg",
    "Ningning (aespa)": "https://dbkpop.com/wp-content/uploads/2024/10/aespa_Whiplash_MV_Teaser_Ningning_1.jpg",
    "카리나 (aespa)": "https://dbkpop.com/wp-content/uploads/2024/10/aespa_Whiplash_MV_Teaser_Karina_8.jpg",
    "닝닝 (aespa)": "https://dbkpop.com/wp-content/uploads/2024/10/aespa_Whiplash_MV_Teaser_Ningning_1.jpg",

    "Wonyoung (IVE)": "https://dbkpop.com/wp-content/uploads/2024/04/ive_Switch_concept_wonyoung.jpg",
    "Yujin (IVE)": "https://dbkpop.com/wp-content/uploads/2024/04/ive_Switch_concept_yujin.jpg",
    "장원영 (IVE)": "https://dbkpop.com/wp-content/uploads/2024/04/ive_Switch_concept_wonyoung.jpg",
    "안유진 (IVE)": "https://dbkpop.com/wp-content/uploads/2024/04/ive_Switch_concept_yujin.jpg",

    "Nayeon (TWICE)": "https://dbkpop.com/wp-content/uploads/2024/12/twice_strategy_concept_Nayeon_1.jpg",
    "Tzuyu (TWICE)": "https://dbkpop.com/wp-content/uploads/2024/12/twice_strategy_concept_Tzuyu_1.jpg",
    "나연 (TWICE)": "https://dbkpop.com/wp-content/uploads/2024/12/twice_strategy_concept_Nayeon_1.jpg",
    "쯔위 (TWICE)": "https://dbkpop.com/wp-content/uploads/2024/12/twice_strategy_concept_Tzuyu_1.jpg",

    "Lisa (BLACKPINK)": "https://dbkpop.com/wp-content/uploads/2022/08/blackpink_pink_venom_concept_lisa.jpg",
    "Rose (BLACKPINK)": "https://dbkpop.com/wp-content/uploads/2022/08/blackpink_pink_venom_concept_rose.jpg",
    "Jennie (BLACKPINK)": "https://dbkpop.com/wp-content/uploads/2022/08/blackpink_pink_venom_concept_jennie.jpg",
    "Jisoo (BLACKPINK)": "https://dbkpop.com/wp-content/uploads/2022/08/blackpink_pink_venom_concept_jisoo.jpg",
    "리사 (BLACKPINK)": "https://dbkpop.com/wp-content/uploads/2022/08/blackpink_pink_venom_concept_lisa.jpg",
    "로제 (BLACKPINK)": "https://dbkpop.com/wp-content/uploads/2022/08/blackpink_pink_venom_concept_rose.jpg",
    "제니 (BLACKPINK)": "https://dbkpop.com/wp-content/uploads/2022/08/blackpink_pink_venom_concept_jennie.jpg",
    "지수 (BLACKPINK)": "https://dbkpop.com/wp-content/uploads/2022/08/blackpink_pink_venom_concept_jisoo.jpg",

    "Chaewon (LE SSERAFIM)": "https://dbkpop.com/wp-content/uploads/2024/08/le_sserafim_crazy_concept_compact_chaewon_3.jpg",
    "Eunchae (LE SSERAFIM)": "https://dbkpop.com/wp-content/uploads/2024/08/le_sserafim_crazy_concept_compact_eunchae_1.jpg",
    "김채원 (LE SSERAFIM)": "https://dbkpop.com/wp-content/uploads/2024/08/le_sserafim_crazy_concept_compact_chaewon_3.jpg",
    "홍은채 (LE SSERAFIM)": "https://dbkpop.com/wp-content/uploads/2024/08/le_sserafim_crazy_concept_compact_eunchae_1.jpg",

    "Joy (Red Velvet)": "https://dbkpop.com/wp-content/uploads/2022/11/red_velvet_the_reve_festival_2022_birthday_teaser_ReVe_Power_Joy_1.jpg",
    "Yeri (Red Velvet)": "https://dbkpop.com/wp-content/uploads/2022/11/red_velvet_the_reve_festival_2022_birthday_teaser_ReVe_Power_Yeri_1.jpg",
    "조이 (Red Velvet)": "https://dbkpop.com/wp-content/uploads/2022/11/red_velvet_the_reve_festival_2022_birthday_teaser_ReVe_Power_Joy_1.jpg",
    "예리 (Red Velvet)": "https://dbkpop.com/wp-content/uploads/2022/11/red_velvet_the_reve_festival_2022_birthday_teaser_ReVe_Power_Yeri_1.jpg",

    "Miyeon ((G)I-DLE)": "https://dbkpop.com/wp-content/uploads/2024/01/GIDLE_2_Teaser_Miyeon_1.jpg",
    "Shuhua ((G)I-DLE)": "https://dbkpop.com/wp-content/uploads/2024/01/GIDLE_2_Teaser_Shuhua_1.jpg",
    "미연 ((G)I-DLE)": "https://dbkpop.com/wp-content/uploads/2024/01/GIDLE_2_Teaser_Miyeon_1.jpg",
    "슈화 ((G)I-DLE)": "https://dbkpop.com/wp-content/uploads/2024/01/GIDLE_2_Teaser_Shuhua_1.jpg",

    "Haewon (NMIXX)": "https://dbkpop.com/wp-content/uploads/2024/01/nmixx_fe3O4_break_teaser_dash_haewon_1.jpg",
    "Jiwoo (NMIXX)": "https://dbkpop.com/wp-content/uploads/2024/01/nmixx_fe3O4_break_teaser_dash_jiwoo_1.jpg",
    "해원 (NMIXX)": "https://dbkpop.com/wp-content/uploads/2024/01/nmixx_fe3O4_break_teaser_dash_haewon_1.jpg",
    "지우 (NMIXX)": "https://dbkpop.com/wp-content/uploads/2024/01/nmixx_fe3O4_break_teaser_dash_jiwoo_1.jpg",

    "Yeji (ITZY)": "https://dbkpop.com/wp-content/uploads/2023/12/itzy_born_to_be_teaser_yeji_1.jpg",
    "Ryujin (ITZY)": "https://dbkpop.com/wp-content/uploads/2023/12/itzy_born_to_be_teaser_ryujin_1.jpg",
    "예지 (ITZY)": "https://dbkpop.com/wp-content/uploads/2023/12/itzy_born_to_be_teaser_yeji_1.jpg",
    "류진 (ITZY)": "https://dbkpop.com/wp-content/uploads/2023/12/itzy_born_to_be_teaser_ryujin_1.jpg",

    "Minji (NewJeans)": "https://dbkpop.com/wp-content/uploads/2022/07/newjeans_debut_teaser_2_Minji.jpg",
    "Hyein (NewJeans)": "https://dbkpop.com/wp-content/uploads/2022/07/newjeans_debut_teaser_2_Hyein.jpg",
    "민지 (NewJeans)": "https://dbkpop.com/wp-content/uploads/2022/07/newjeans_debut_teaser_2_Minji.jpg",
    "혜인 (NewJeans)": "https://dbkpop.com/wp-content/uploads/2022/07/newjeans_debut_teaser_2_Hyein.jpg",
    "해린 (NewJeans)": "https://dbkpop.com/wp-content/uploads/2023/06/NewJeans_Get_Up_Teaser_7.jpg",
    "하니 (NewJeans)": "https://dbkpop.com/wp-content/uploads/2023/06/NewJeans_Get_Up_Teaser_1.jpg"
};

async function run() {
    console.log("Final Verified Idol Image Update Script Started...");

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
        let newUrl = VERIFIED_URL_MAPPING(item.name);

        if (newUrl) {
            console.log(`Updating ${item.name} -> ${newUrl.substring(0, 60)}...`);
            const { error: upErr } = await supabase
                .from('worldcup_items')
                .update({ image_url: newUrl })
                .eq('id', item.id);
            if (upErr) console.error("Update error for", item.name, upErr.message);
        } else {
            console.warn(`No verified URL for ${item.name}. Using fallback avatar.`);
            const fallbackUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(item.name)}&size=500&background=random&color=fff&font-size=0.25`;
            await supabase
                .from('worldcup_items')
                .update({ image_url: fallbackUrl })
                .eq('id', item.id);
        }
    }
    console.log("Done!");
}

function VERIFIED_URL_MAPPING(name) {
    // Exact match first
    if (VERIFIED_URLS[name]) return VERIFIED_URLS[name];

    // Key match (e.g. "장원영" in "장원영 (IVE)")
    for (let key in VERIFIED_URLS) {
        if (name.includes(key) || key.includes(name)) return VERIFIED_URLS[key];
    }
    return null;
}

run();
