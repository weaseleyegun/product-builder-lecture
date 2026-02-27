// seed_worldcups.js - Seed worldcup & tier list data into DB
// Usage: node scripts/seed_worldcups.js (from quiz-platform root)

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.dev.vars') });
var supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

function delay(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

// Worldcup data: each has title, description, thumbnail_url, and 16 items
var WORLDCUPS = [
    {
        title: '🍜 한국인이 가장 좋아하는 음식 월드컵',
        description: '당신의 최애 한식은? 16강부터 시작!',
        thumbnail: 'images/thumbnails/wc_food.png',
        items: [
            { name: '김치찌개', image_url: 'https://i.imgur.com/JkXbKNz.jpg' },
            { name: '된장찌개', image_url: 'https://i.imgur.com/2fQJzKm.jpg' },
            { name: '떡볶이', image_url: 'https://i.imgur.com/R7k0B4W.jpg' },
            { name: '삼겹살', image_url: 'https://i.imgur.com/5tY9bLx.jpg' },
            { name: '치킨', image_url: 'https://i.imgur.com/xWG2w8n.jpg' },
            { name: '비빔밥', image_url: 'https://i.imgur.com/4pBK5Bz.jpg' },
            { name: '냉면', image_url: 'https://i.imgur.com/qF8VkMU.jpg' },
            { name: '불고기', image_url: 'https://i.imgur.com/8BxQJYr.jpg' },
            { name: '라면', image_url: 'https://i.imgur.com/dW1kPFe.jpg' },
            { name: '순두부찌개', image_url: 'https://i.imgur.com/HRm3nKZ.jpg' },
            { name: '갈비찜', image_url: 'https://i.imgur.com/tmQ6a2d.jpg' },
            { name: '잡채', image_url: 'https://i.imgur.com/CxPzJ6H.jpg' },
            { name: '김밥', image_url: 'https://i.imgur.com/mF3yXhT.jpg' },
            { name: '제육볶음', image_url: 'https://i.imgur.com/LnKyV9d.jpg' },
            { name: '감자탕', image_url: 'https://i.imgur.com/Rv2pTgQ.jpg' },
            { name: '족발', image_url: 'https://i.imgur.com/NkXaW7c.jpg' },
        ]
    },
    {
        title: '🐶 세계에서 가장 귀여운 강아지 월드컵',
        description: '심쿵 주의! 귀여운 강아지 16종 대결',
        thumbnail: 'images/thumbnails/wc_dog.png',
        items: [
            { name: '골든 리트리버', image_url: 'https://images.dog.ceo/breeds/retriever-golden/n02099601_1.jpg' },
            { name: '웰시 코기', image_url: 'https://images.dog.ceo/breeds/corgi-cardigan/n02113186_1.jpg' },
            { name: '시바견', image_url: 'https://images.dog.ceo/breeds/shiba/shiba-8.jpg' },
            { name: '포메라니안', image_url: 'https://images.dog.ceo/breeds/pomeranian/n02112018_1.jpg' },
            { name: '허스키', image_url: 'https://images.dog.ceo/breeds/husky/n02110185_1.jpg' },
            { name: '사모예드', image_url: 'https://images.dog.ceo/breeds/samoyed/n02111889_1.jpg' },
            { name: '말티즈', image_url: 'https://images.dog.ceo/breeds/maltese/n02085936_1.jpg' },
            { name: '비숑 프리제', image_url: 'https://images.dog.ceo/breeds/bichon/1.jpg' },
            { name: '프렌치 불독', image_url: 'https://images.dog.ceo/breeds/bulldog-french/n02108915_1.jpg' },
            { name: '요크셔 테리어', image_url: 'https://images.dog.ceo/breeds/terrier-yorkshire/n02094433_1.jpg' },
            { name: '래브라도', image_url: 'https://images.dog.ceo/breeds/labrador/n02099712_1.jpg' },
            { name: '푸들', image_url: 'https://images.dog.ceo/breeds/poodle-standard/n02113799_1.jpg' },
            { name: '비글', image_url: 'https://images.dog.ceo/breeds/beagle/n02088364_1.jpg' },
            { name: '닥스훈트', image_url: 'https://images.dog.ceo/breeds/dachshund/dachshund-2.jpg' },
            { name: '보더 콜리', image_url: 'https://images.dog.ceo/breeds/collie-border/n02106166_1.jpg' },
            { name: '치와와', image_url: 'https://images.dog.ceo/breeds/chihuahua/n02085620_1.jpg' },
        ]
    },
    {
        title: '🎬 역대 최고의 애니메이션 캐릭터 월드컵',
        description: '최애 애니 캐릭터는 누구? 16강 토너먼트!',
        thumbnail: 'images/thumbnails/wc_anime.png',
        items: [
            { name: '나루토 (나루토)', image_url: 'https://cdn.myanimelist.net/images/characters/2/284121.jpg' },
            { name: '루피 (원피스)', image_url: 'https://cdn.myanimelist.net/images/characters/9/310307.jpg' },
            { name: '고쿠 (드래곤볼)', image_url: 'https://cdn.myanimelist.net/images/characters/15/380673.jpg' },
            { name: '탄지로 (귀멸의 칼날)', image_url: 'https://cdn.myanimelist.net/images/characters/6/386735.jpg' },
            { name: '이타치 (나루토)', image_url: 'https://cdn.myanimelist.net/images/characters/9/284122.jpg' },
            { name: '레비 (진격의 거인)', image_url: 'https://cdn.myanimelist.net/images/characters/2/174733.jpg' },
            { name: '에렌 (진격의 거인)', image_url: 'https://cdn.myanimelist.net/images/characters/10/216895.jpg' },
            { name: '고죠 사토루 (주술회전)', image_url: 'https://cdn.myanimelist.net/images/characters/15/422168.jpg' },
            { name: '조로 (원피스)', image_url: 'https://cdn.myanimelist.net/images/characters/3/100534.jpg' },
            { name: '카카시 (나루토)', image_url: 'https://cdn.myanimelist.net/images/characters/7/284129.jpg' },
            { name: '사이타마 (원펀맨)', image_url: 'https://cdn.myanimelist.net/images/characters/11/294389.jpg' },
            { name: '킬루아 (헌터x헌터)', image_url: 'https://cdn.myanimelist.net/images/characters/2/186599.jpg' },
            { name: '스파이크 (카우보이 비밥)', image_url: 'https://cdn.myanimelist.net/images/characters/7/283739.jpg' },
            { name: '엘릭 형제 (강철의 연금술사)', image_url: 'https://cdn.myanimelist.net/images/characters/7/284131.jpg' },
            { name: '제니쯔 (귀멸의 칼날)', image_url: 'https://cdn.myanimelist.net/images/characters/3/378295.jpg' },
            { name: '이노스케 (귀멸의 칼날)', image_url: 'https://cdn.myanimelist.net/images/characters/7/386737.jpg' },
        ]
    },
    {
        title: '🎮 역대 최고의 게임 캐릭터 월드컵',
        description: '전설의 게임 캐릭터 16인 대결!',
        thumbnail: 'images/thumbnails/wc_game.png',
        items: [
            { name: '마리오 (슈퍼마리오)', image_url: 'https://upload.wikimedia.org/wikipedia/en/a/a9/MarioNSMBUDeluxe.png' },
            { name: '링크 (젤다의 전설)', image_url: 'https://upload.wikimedia.org/wikipedia/en/3/3c/Link_from_The_Legend_of_Zelda_Tears_of_the_Kingdom_key_art.png' },
            { name: '피카츄 (포켓몬)', image_url: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/25.png' },
            { name: '커비 (별의 커비)', image_url: 'https://upload.wikimedia.org/wikipedia/en/d/d0/Kirbycharacter.png' },
            { name: '소닉 (소닉)', image_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/66/Sonic_the_Hedgehog.svg/200px-Sonic_the_Hedgehog.svg.png' },
            { name: '클라우드 (FF7)', image_url: 'https://upload.wikimedia.org/wikipedia/en/1/1a/Cloud_Strife.png' },
            { name: '스네이크 (메탈기어)', image_url: 'https://upload.wikimedia.org/wikipedia/en/e/ed/Old_Snake.jpg' },
            { name: '마스터 치프 (헤일로)', image_url: 'https://upload.wikimedia.org/wikipedia/en/c/c7/MasterChief_Halo3.png' },
            { name: '크레토스 (갓 오브 워)', image_url: 'https://upload.wikimedia.org/wikipedia/en/c/ce/Kratos_%28God_of_War_2018%29.jpg' },
            { name: '2B (니어 오토마타)', image_url: 'https://upload.wikimedia.org/wikipedia/en/a/a5/Nier_Automata_cover_art.jpg' },
            { name: '젤다 (젤다의 전설)', image_url: 'https://upload.wikimedia.org/wikipedia/en/c/cd/Princess_Zelda_-_Tears_of_the_Kingdom.jpg' },
            { name: '팩맨 (팩맨)', image_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/49/Pacman.svg/200px-Pacman.svg.png' },
            { name: '스티브 (마인크래프트)', image_url: 'https://upload.wikimedia.org/wikipedia/en/0/0a/Steve_%28Minecraft%29.png' },
            { name: '아서 모건 (RDR2)', image_url: 'https://upload.wikimedia.org/wikipedia/en/b/b6/Arthur_Morgan.jpg' },
            { name: '조커 (페르소나5)', image_url: 'https://upload.wikimedia.org/wikipedia/en/b/bc/Joker_in_Persona_5.png' },
            { name: '라라 크로프트 (툼레이더)', image_url: 'https://upload.wikimedia.org/wikipedia/en/6/69/Lara_Croft.png' },
        ]
    },
    {
        title: '☕ 한국 카페 음료 월드컵',
        description: '당신의 최애 카페 음료는? 16강 시작!',
        thumbnail: 'images/thumbnails/wc_cafe.png',
        items: [
            { name: '아메리카노', image_url: 'https://i.imgur.com/7vLBsmS.jpg' },
            { name: '카페라떼', image_url: 'https://i.imgur.com/KqR3Egs.jpg' },
            { name: '바닐라 라떼', image_url: 'https://i.imgur.com/mL8FPxQ.jpg' },
            { name: '카라멜 마키아토', image_url: 'https://i.imgur.com/9BzNf5p.jpg' },
            { name: '아이스티', image_url: 'https://i.imgur.com/GHVpHXf.jpg' },
            { name: '말차 라떼', image_url: 'https://i.imgur.com/VpYJk2K.jpg' },
            { name: '딸기 라떼', image_url: 'https://i.imgur.com/bD2nyHv.jpg' },
            { name: '초코 프라푸치노', image_url: 'https://i.imgur.com/6BVYHX0.jpg' },
            { name: '에스프레소', image_url: 'https://i.imgur.com/ztHF4XL.jpg' },
            { name: '플랫 화이트', image_url: 'https://i.imgur.com/jWF5J2r.jpg' },
            { name: '콜드브루', image_url: 'https://i.imgur.com/rNhHLCn.jpg' },
            { name: '레몬에이드', image_url: 'https://i.imgur.com/P5zRnDh.jpg' },
            { name: '핫초코', image_url: 'https://i.imgur.com/x3fAGq8.jpg' },
            { name: '자몽 에이드', image_url: 'https://i.imgur.com/bKWqYt5.jpg' },
            { name: '유자차', image_url: 'https://i.imgur.com/Cv3rN8m.jpg' },
            { name: '밀크티', image_url: 'https://i.imgur.com/Wm7Hk1g.jpg' },
        ]
    },
];

async function main() {
    console.log('🚀 월드컵 & 티어리스트 데이터 시딩 시작!\n');

    var { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: 'agent@quizrank.com',
        password: 'seed_password_1234!'
    });

    if (authError || !authData.user) {
        console.error('❌ 인증 실패:', authError ? authError.message : 'no user');
        return;
    }
    var userId = authData.user.id;
    console.log('✅ 인증 완료 (User ID: ' + userId + ')\n');

    // Insert Worldcups
    for (var wc of WORLDCUPS) {
        console.log('⏳ "' + wc.title + '" 생성 중...');

        var { data: cupData, error: cupError } = await supabase
            .from('worldcups')
            .insert([{
                title: wc.title,
                description: wc.description,
                play_count: Math.floor(Math.random() * 500) + 100,
                creator_id: userId
            }])
            .select()
            .single();

        if (cupError) {
            console.error('  ❌ 월드컵 생성 실패:', cupError.message);
            continue;
        }

        var itemsToInsert = wc.items.map(function (item) {
            var safeUrl = item.image_url;
            // imgur나 myanimelist는 핫링킹 차단 이슈로 이미지가 깨지므로 아바타 생성기로 임시 교체
            if (safeUrl.includes('imgur.com') || safeUrl.includes('myanimelist.net')) {
                safeUrl = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(item.name) + '&size=500&background=random&color=fff&font-size=0.25';
            }

            return {
                worldcup_id: cupData.id,
                name: item.name,
                image_url: safeUrl,
                win_count: Math.floor(Math.random() * 50),
                match_count: Math.floor(Math.random() * 200) + 50
            };
        });

        var { error: itemsErr } = await supabase.from('worldcup_items').insert(itemsToInsert);
        if (itemsErr) {
            console.error('  ❌ 아이템 삽입 실패:', itemsErr.message);
        } else {
            console.log('  ✅ 완료! (' + wc.items.length + '개 후보)');
        }
        await delay(500);
    }

    console.log('\n🎉 모든 월드컵 데이터 시딩 완료!');
}

main();
