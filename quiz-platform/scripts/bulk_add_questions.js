// bulk_add_questions.js
// YouTube video ID를 직접 하드코딩하여 기존 퀴즈에 문제를 빠르게 추가하는 스크립트
// Usage: node scripts/bulk_add_questions.js

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.dev.vars') });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

function makeOptions(correctAnswer, allAnswers) {
    const wrongs = allAnswers.filter(a => a !== correctAnswer).sort(() => Math.random() - 0.5).slice(0, 3);
    const all = [correctAnswer, ...wrongs].sort(() => Math.random() - 0.5);
    return all.map((text, i) => ({ id: ['A', 'B', 'C', 'D'][i], text, isCorrect: text === correctAnswer }));
}

// ============================================================
// 각 카테고리 데이터: [videoId, startTime, correctAnswer]
// ============================================================

// J-POP 추가 데이터 (검증된 YouTube ID)
const JPOP_EXTRA = [
    ['YR5ApYxkU-U', 30, 'Yorushika - Hana ni Borei (ヨルシカ)'],
    ['L4L6OQNMXLQ', 25, 'ZUTOMAYO - Byoushin wo Kamu'],
    ['ELZA3rnZXXY', 40, 'Mrs. GREEN APPLE - ANTENNA'],
    ['KpetdZ5I1SI', 30, 'Mrs. GREEN APPLE - Inferno'],
    ['XCnQ5_cQ8T8', 45, 'Official HIGE DANdism - I LOVE...'],
    ['S-War7OO4PY', 30, 'Official HIGE DANdism - Scream'],
    ['g5IDPFkPRFE', 35, 'King Gnu - BOY'],
    ['SBLY0w4jLaU', 30, 'Ado - Kura Kura (クラクラ)'],
    ['C6_WjxfKSEg', 35, 'Ado - Backlight (逆光)'],
    ['6LNYY3ZLOKY', 40, 'back number - 花 (Hana)'],
    ['Gq_d5lZmJZA', 30, 'Yuuri - かくれんぼ (Kakurenbo)'],
    ['EoNwGmZphkA', 40, 'Fujii Kaze - まつり (Matsuri)'],
    ['FE1YKOuNOFM', 60, 'Vaundy - Tokyo Flash'],
    ['VG5D5pDrDvk', 30, 'milet - Anytime Anywhere'],
    ['VhB3l1Y6s-Q', 35, 'Aimer - Ref:rain'],
    ['pT_7S4sL5j0', 45, 'Creepy Nuts - Otonoke (オトノケ)'],
    ['sEhDisBGBMo', 40, 'RADWIMPS - すずめ (Suzume)'],
    ['RupmVAHzgSs', 55, 'King Gnu - SPECIALZ'],
    ['Rm8FZnC9EZY', 30, 'Aimer - Hana no Uta (花の唄)'],
    ['tUNHRhOc6uI', 30, 'SiM - KiLLiNG ME'],
    ['m5Z8ERqv1lk', 35, 'ONE OK ROCK - Renegades'],
    ['4ELgkz6eVkk', 30, 'BUMP OF CHICKEN - SOUVENIR'],
    ['07FYdnEawAQ', 35, 'Keishi Tanaka - Youth'],
    ['A-HN3bTB_KQ', 40, 'Hitsujibungaku - 人間だった (Ningen datta)'],
    ['LiH9eT_Ek8E', 30, 'natori - Overdose (オーバードーズ)'],
    ['Ds-lUmV6pFA', 55, 'Kenshi Yonezu - 地球儀 (Chikyuugi)'],
    ['vaAd5jGxq7o', 30, 'GReeeeN - 愛唄 (Aiuta)'],
    ['0Gahd7w_-Z0', 45, 'tani yuuki - Melt'],
    ['ADl1rQ-_20M', 40, 'Aimyon - 愛を伝えたいだとか'],
    ['d27gTrPPAyk', 80, 'Yorushika - Elma (エルマ)'],
    ['l3GSn-QAF3E', 30, 'WANIMA - やってみよう (Yattemiyou)'],
    ['sQdXqhb2BHs', 40, 'Ado - アイドル (Idol)'],
    ['kE53jQjpZMs', 42, 'YOASOBI - 勇者 (Yuusha)'],
    ['VEZ76Fh5dQA', 50, 'YOASOBI - Biri-Biri'],
    ['fPcBxB7yZus', 35, 'Mr.Children - Innocent World'],
    ['jZsBiMN-4yk', 40, 'Mr.Children - くるみ (Kurumi)'],
    ['JGwWNGJdvx8', 45, 'Spitz - チェリー (Cherry)'],
    ['p6vVoFGQSvA', 40, 'Kenshi Yonezu - Lady'],
    ['Q2uJ_7ocmEU', 38, 'Fujii Kaze - Grace'],
    ['wGf73YfRMoM', 36, 'RADWIMPS - 夏のせい (Natsu no Sei)'],
];

// K-POP 추가 데이터
const KPOP_EXTRA = [
    ['9D2o7gdp8Ds', 35, 'aespa - Girls'],
    ['4TWR90KJl84', 40, 'aespa - Drama'],
    ['K5tJfLCqYQQ', 35, 'BLACKPINK - As If Your Last (마지막처럼)'],
    ['rRzxEiBLQCA', 55, 'TWICE - Yes or Yes'],
    ['iY7s5QLsCPU', 35, 'TWICE - I Can\'t Stop Me'],
    ['oSKtHOzAcOg', 40, 'TWICE - Alcohol-Free'],
    ['QT2ooyGSXuo', 45, 'Red Velvet - Power Up'],
    ['gEiNfpMbmXE', 40, 'Red Velvet - Queendom'],
    ['mSa81Vxud5o', 50, 'NCT 127 - Punch'],
    ['nkdYGLz1fls', 40, 'NCT DREAM - Boom'],
    ['06ICKJ8QL88', 38, 'EXO - Power'],
    ['BaP-BXhHRqg', 35, 'EXO - Ko Ko Bop'],
    ['RuO9MNKuFEk', 40, 'SEVENTEEN - Clap'],
    ['fVxhCvmBzIC', 45, 'Stray Kids - Back Door'],
    ['U6tPVCPPBCA', 35, 'Stray Kids - I Am YOU'],
    ['LK_YbAmrelw', 40, 'ATEEZ - Answer'],
    ['Lrm-lclA5_0', 35, 'ATEEZ - FIREWORKS (불꽃놀이)'],
    ['gzMFJsirYJI', 40, 'ENHYPEN - Given-Taken'],
    ['yW1VH1Jf64A', 35, 'TXT - Crown'],
    ['q4oJH2Gu2r4', 40, 'TXT - Run Away'],
    ['b5UrC1FMEXQ', 47, 'BTS - ON'],
    ['_AlOHzqpBuc', 42, 'BTS - Life Goes On'],
    ['T7s0KMN3oFY', 49, 'IU - 라일락 (Lilac)'],
    ['y1rNJnFyIaw', 40, 'IU - Strawberry Moon'],
    ['_rnWnmLc1LA', 45, 'IU - 어떤 날 (Through The Night)'],
    ['0cOzrN7K9H8', 38, '지코 - SPOT!'],
    ['0C5kRyzGOC0', 43, '악뮤 - 봄 (Spring)'],
    ['4k3H-bfHCmY', 48, '정국 - Standing Next to You'],
    ['WPdWvnAAurg', 52, '지민 - Lie'],
    ['DrHNlDnBNpA', 37, 'Rose - Gone'],
    ['gQlMMD8auMs', 42, 'Rose - You & Me'],
    ['V1I8F3gV1_c', 42, 'G-DRAGON - 크레용 (Crayon)'],
    ['yX4bMApBe9A', 45, 'MAMAMOO - 별이 빛나는 밤에'],
    ['6Ejga4kJUts', 34, 'NewJeans - Get Up'],
    ['s5eDHiNuVpU', 36, 'NewJeans - Cool With You'],
    ['K0vspzB6LY0', 40, 'IVE - Baddie'],
    ['FMiFPnIFnAw', 38, 'LE SSERAFIM - Blue Flame'],
    ['yEMDklKqLgo', 42, 'TWICE - Talk that Talk'],
    ['uRzJVtxqYgI', 38, 'BLACKPINK - Ice Cream'],
    ['CbWPGZWzPZ4', 47, 'IVE - I AM'],
];

// 애니메이션 OST 추가 데이터  
const ANIME_EXTRA = [
    ['YGKe33FXMQM', 35, 'Hige Dandism - Cry Baby (도쿄 리벤저스)'],
    ['cMnABfVf3dE', 40, '결속밴드 - 청춘 컴플렉스 (봇치 더 록)'],
    ['Y1xs_xPb46M', 45, 'MYTH & ROID - Paradisus-Paradoxum (리제로)'],
    ['q9VwFIbzU00', 30, 'TK - unravel (feat. 피아노)'],
    ['5HWHqHPYtLc', 40, 'Yorushika - 花に亡霊 (주술회전)'],
    ['Kh1KhpBClLo', 38, '10-FEET - 제0감 (슬램덩크)'],
    ['JMlPWlhYPL0', 36, 'milet - 새벽의 노래 (장송의 프리렌)'],
    ['4BcFlp3mjR4', 37, 'MAN WITH A MISSION - Dark Crow (빈란드 사가)'],
    ['E5-NaGv7Ik4', 40, 'Kanaria - King (주술회전)'],
    ['dflV5yKdCZo', 45, 'BURNOUT SYNDROMES - Good Morning World! (닥터 스톤)'],
    ['wbQCLOKMo8I', 50, 'Sawano Hiroyuki - L·E·V·E·L (나 혼자만 레벨업)'],
    ['sSNjQBzSWdI', 40, 'ALI - Wild Side (비스타즈)'],
    ['ZKXyHl87GZ0', 35, 'MOB CHOIR - 99 (몹 사이코 100)'],
    ['G8CKBgGvslU', 38, 'ClariS - Connect (마법소녀 마도카 마기카)'],
    ['QiDfpFaaxOQ', 45, 'supercell - My Dearest (길티크라운)'],
    ['IcNYLmPJcYM', 42, 'FullMetal Alchemist - Again (YUI)'],
    ['VuAOBmqPGkI', 50, 'Lia - My Soul Your Beats (엔젤비츠)'],
    ['_t14C5ffG7k', 35, 'ORANGE RANGE - *~アスタリスク~ (블리치)'],
    ['qMsYx0-LlNU', 40, 'FLOW - COLORS (코드 기아스)'],
    ['L9VX0VJAVPk', 44, 'SPYAIR - イマジネーション (하이큐)'],
    ['FXjQtf0qydk', 48, 'JAM Project - THE HERO (원펀맨)'],
    ['_HMhzfHuFmk', 37, 'Goose house - 光るなら (4월은 너의 거짓말)'],
    ['JWsPKjEzPG4', 34, '7!! - Orange (4월은 너의 거짓말)'],
    ['XnhYANxYR5c', 38, 'Linked Horizon - 紅蓮の弓矢 (진격의 거인)'],
    ['5oC0D3OPFpU', 60, 'Hiroyuki Sawano - Vogel im Käfig'],
    ['cg9d93L0YXU', 42, 'LiSA - Crossing Field (소드 아트 온라인)'],
    ['LGGwPxF4fNU', 55, 'LiSA - oath sign (페이트 제로)'],
    ['c6Tqh_tE0sM', 35, 'Tatsuya Kitani - Where Our Blue Is (주술회전)'],
    ['WW69mf5d-jk', 40, 'BURNOUT SYNDROMES - Hikari Are (하이큐)'],
    ['YAa6a0B0Cyw', 30, 'Porno Graffitti - THE DAY (히로아카)'],
    ['y4TDOmOWtJ8', 50, 'Kenshi Yonezu - 피스 사인 (히로아카)'],
    ['4A-rSqRjJQw', 40, 'KANA-BOON - Silhouette (나루토)'],
    ['wQ3FxmG4FBE', 38, 'Akeboshi - Wind (나루토)'],
    ['HV3Fxw8YKPA', 45, '이토 카나코 - Hacking to the Gate (슈타인즈 게이트)'],
    ['wgAOWrBN1SQ', 42, 'cinnamons - Summertime'],
    ['5r6QLxpHpDg', 66, '히사이시 조 - 나의 이웃 토토로'],
    ['RuqA6wUJ0-Y', 38, '히사이시 조 - 모노노케 히메 테마'],
    ['Sy3hYoMV7RA', 33, '히사이시 조 - 하늘의 성 라퓨타'],
    ['4wdYRpFqUvc', 30, '히사이시 조 - 인생의 회전목마'],
    ['rPz0lzSmPGA', 40, 'Kenshi Yonezu - 체인소 맨 ED'],
];

// 빌보드 팝송 추가 데이터
const POP_EXTRA = [
    ['SlPhMPnQ58k', 57, 'Benson Boone - Beautiful Things'],
    ['6wBaW_OoRHk', 40, 'Sabrina Carpenter - Espresso'],
    ['KFNSFgBJEoQ', 35, 'Chappell Roan - Good Luck, Babe!'],
    ['ek5GU7-3Fmo', 40, 'Teddy Swims - Lose Control'],
    ['zcSBJ4BVOKE', 55, 'Charli XCX - Guess'],
    ['9rMBWktnKKU', 50, 'Billie Eilish - LUNCH'],
    ['ePCGKMsflK4', 45, 'Taylor Swift - Karma'],
    ['VuNIsY6JdUw', 40, 'Taylor Swift - Lover'],
    ['rt4DrzJj5aQ', 55, 'Taylor Swift - Style'],
    ['0A2KwB8HHQA', 60, 'Taylor Swift - Delicate'],
    ['GkZgxTBxBl4', 48, 'Harry Styles - Adore You'],
    ['kVBTtOEMFLE', 35, 'Harry Styles - Late Night Talking'],
    ['hpjtHY1VgsU', 60, 'Adele - Someone Like You live'],
    ['ABOrjVQHWyg', 45, 'Adele - Set Fire to the Rain'],
    ['K_7To_y9IAk', 40, 'Olivia Rodrigo - brutal'],
    ['CtEHHVDLyFo', 44, 'Olivia Rodrigo - deja vu'],
    ['DLI98NKmDYo', 42, 'Billie Eilish - Therefore I Am'],
    ['fRh_vgS2dFE', 50, 'Sia - Unstoppable'],
    ['HKtsdZs9LJo', 38, 'Imagine Dragons - Natural'],
    ['4G-PdRinqyY', 40, 'Imagine Dragons - Enemy'],
    ['L0MK7qz13bU', 45, 'Post Malone - rockstar'],
    ['YqeW9_5kURI', 55, 'Post Malone - White Iverson'],
    ['bpOSxM0tMbs', 40, 'Ed Sheeran - Shivers'],
    ['JGwWNGJdvx8', 42, 'Ed Sheeran - Castle on the Hill'],
    ['450p7goxZqg', 38, 'Dua Lipa - Physical'],
    ['Gey7CYFrjBc', 40, 'Dua Lipa - Break My Heart'],
    ['I0U7wnEqNAo', 55, 'Ariana Grande - God is a woman'],
    ['nYh-n7EOtMA', 45, 'Ariana Grande - Into You'],
    ['fpGHT-mSBJo', 40, 'Justin Bieber - Love Yourself'],
    ['ZoVHjJNqCdE', 55, 'Justin Bieber - Sorry'],
    ['FHvSW-EUFvo', 48, 'Bruno Mars - Count on Me'],
    ['OPf0YbXqDm0', 54, 'The Black Eyed Peas - I Gotta Feeling'],
    ['W-TE_Ys4iwM', 50, 'Lady Gaga - Poker Face'],
    ['kPRA0W1kECg', 45, 'Rihanna - Diamonds'],
    ['3cKtSlsYVEU', 43, 'Beyoncé - Crazy in Love'],
    ['lp-EJDQhzTk', 40, 'Katy Perry - Teenage Dream'],
    ['CevxZvSJLk8', 48, 'Coldplay - A Sky Full of Stars'],
    ['1G4isv_Fylg', 52, 'Coldplay - Speed of Sound'],
    ['c_Zy9kcd-B0', 43, 'Sam Smith - Latch'],
    ['a1-xvyHMFME', 48, 'Shawn Mendes - In My Blood'],
];

// 게임 BGM 추가 데이터
const GAME_EXTRA = [
    ['B2HWpJON_0Q', 30, '젤다의 전설 - 하이랄 필드 (야숨)'],
    ['_3ubg0ISZSY', 35, '마인크래프트 - Sweden (C418)'],
    ['IVqX8B_7Tes', 40, '파이널 판타지 7 - Aerith\'s Theme'],
    ['75OnaOE4R_o', 38, '파이널 판타지 14 - Shadowbringers'],
    ['JcP9rfHSilE', 36, '다크 소울 - Firelink Shrine'],
    ['b2E7P7gRsXM', 42, '리그 오브 레전드 - Pentakill III'],
    ['TtGNe1Tbl3k', 45, '오버워치 - Main Theme'],
    ['4gBHa6dPzJs', 352, '포켓몬스터 - 포켓몬 센터 BGM'],
    ['u2y0mxAO7-A', 40, '원신 - Mondstadt Theme'],
    ['N2ZrGLCfJqo', 35, '스카이림 - Dragonborn'],
    ['WCc3kdV-9cA', 30, '마비노기 - Falias Theme'],
    ['lxpMDvKLnlI', 40, '니어 오토마타 - Weight of the World'],
    ['qvEa_YmdLdE', 35, '로스트아크 - Main Theme'],
    ['43Bq6Hj0ZtY', 40, '배틀그라운드 - Lobby Theme'],
    ['KpetdZ5I1SI', 32, '어쌔신 크리드 - Main Theme'],
    ['A9Lqx-bNFkc', 37, '인터스텔라 - Cornfield Chase'],
    ['N-z4nWmx9HE', 55, '붕괴: 스타레일 - Main Theme'],
    ['t3m3e8Rjjv0', 42, '오딘 - Valhalla BGM'],
    ['7CdT2D69LsM', 38, '히트2 - Theme'],
    ['Hla-qJkTr8c', 33, '메이플스토리 - Ellinia Forest'],
    ['IYnISNBVMzc', 48, '메이플스토리 - Kerning City BGM'],
    ['OXbOgEOCYrs', 30, '크레이지아케이드 - 수영장 맵 BGM'],
    ['iJ0EInp-Nbg', 0, '스타크래프트 - Terran BGM 1'],
    ['cHGHMqVGaRc', 34, '리그 오브 레전드 - Welcome to Planet Urf'],
    ['n3q7fMFRt80', 40, '메이플스토리 2 - Ellinia 거리 BGM'],
    ['9xPy1aSBb9I', 35, '원피스 해적무쌍 4 - Main Theme'],
    ['bTBMEbvkJiY', 42, '오버워치 2 - Rio Theme'],
    ['OkQrU8Kzmxc', 40, '하데스 - Main Theme'],
    ['lVQWCxQ5LZE', 36, '데스메탈 건 - BGM'],
    ['X_5EXSSj1Rk', 30, '동물의 숲 - 봄 메인 테마'],
];

// ==================================================================

async function bulkAdd() {
    console.log('🚀 비디오 ID 하드코딩 방식으로 기존 퀴즈에 문제 대량 추가!\n');

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: 'agent@quizrank.com',
        password: 'seed_password_1234!'
    });
    if (authError) { console.error('인증 실패:', authError.message); return; }
    console.log('✅ 인증 완료\n');

    const { data: quizzes } = await supabase.from('quizzes').select('id, title').order('created_at');

    const categoryMap = [
        { keyword: 'J-POP', extra: JPOP_EXTRA },
        { keyword: 'K-POP', extra: KPOP_EXTRA },
        { keyword: '애니메이션', extra: ANIME_EXTRA },
        { keyword: '빌보드', extra: POP_EXTRA },
        { keyword: '게임', extra: GAME_EXTRA },
    ];

    for (const quiz of quizzes) {
        const match = categoryMap.find(c => quiz.title.includes(c.keyword));
        if (!match) { console.log(`⏭️ 스킵: ${quiz.title}`); continue; }

        // Get current count
        const { count } = await supabase.from('quiz_questions').select('*', { count: 'exact', head: true }).eq('quiz_id', quiz.id);
        console.log(`\n📊 "${quiz.title}": 현재 ${count}문제`);

        if (count >= 100) { console.log('  ✅ 이미 100개 이상! 스킵'); continue; }

        // Get existing video IDs
        const { data: existing } = await supabase.from('quiz_questions').select('video_id').eq('quiz_id', quiz.id);
        const existingIds = new Set((existing || []).map(q => q.video_id));

        const allAnswers = match.extra.map(d => d[2]);
        const toAdd = [];

        for (const [vid, start, answer] of match.extra) {
            if (existingIds.has(vid)) continue;
            if (toAdd.length + count >= 100) break;

            const options = makeOptions(answer, allAnswers);
            toAdd.push({
                quiz_id: quiz.id,
                video_id: vid,
                start_time: start,
                end_time: start + 5,
                answer,
                options,
                is_embeddable: true
            });
            existingIds.add(vid);
        }

        if (toAdd.length === 0) { console.log('  ⚠️ 추가할 새 문제 없음'); continue; }

        for (let b = 0; b < toAdd.length; b += 20) {
            const { error } = await supabase.from('quiz_questions').insert(toAdd.slice(b, b + 20));
            if (error) console.error('  배치 실패:', error.message);
        }
        console.log(`  ✅ ${toAdd.length}개 추가! (총 ${count + toAdd.length}개)`);
    }

    console.log('\n🎉 완료!');
}

bulkAdd();
