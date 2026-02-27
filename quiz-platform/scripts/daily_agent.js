import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import cron from 'node-cron';

// 1️⃣ 초기 설정 및.dev.vars 파일 로드
dotenv.config({ path: path.resolve(process.cwd(), '.dev.vars') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("오류: SUPABASE_URL 또는 SUPABASE_ANON_KEY가 설정되지 않았습니다.");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ============================================
// 🤖 에이전트 핵심 기능 모음
// ============================================

// [DB 인증 우회 유틸리티]: 자동화 스크립트로서 쓰기 권한을 얻기 위해 로그인
async function authenticateAgent() {
    const adminEmail = "agent@quizrank.com";
    const adminPassword = "seed_password_1234!";

    let { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: adminEmail,
        password: adminPassword,
    });

    if (authError || !authData.user) {
        console.log("ℹ️ 에이전트용 계정이 없으므로, 새 계정 생성을 시도합니다.");
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            email: adminEmail,
            password: adminPassword,
            options: { data: { user_name: 'Content Agent' } }
        });
        if (signUpError) {
            console.error("❌ 에이전트 로그인/생성 실패:", signUpError.message);
            console.log("\n💡 [해결 방법]: Supabase에서 짧은 시간 내 여러 번 계정을 만들려다 발생한 에러(Rate Limit)일 수 있습니다.");
            console.log("Supabase 대시보드 [Authentication] -> [Users] -> [Add user] 에서 수동으로 'agent@quizrank.com', 비밀번호 'seed_password_1234!' 계정을 직접 하나 만들어두시면 이 에러를 완벽하게 피하고 자동 로그인됩니다.");
            return null;
        }
        authData = signUpData;
    }
    console.log(`✅ 에이전트 인증 완료! (User ID: ${authData.user.id})`);
    return authData.user.id;
}

// [기능 1]: 오늘의 랜덤 Jikan 애니메이션 캐릭터 16강 수집
async function fetchDailyAnime() {
    console.log("🔥 매일밤 Jikan(MyAnimeList) API에서 애니메이션 데이터를 탐색합니다...");
    try {
        // 매일매일 다른 캐릭터가 나오도록 페이지를 무작위로 선택 (1~10페이지 중 1개)
        const randomPage = Math.floor(Math.random() * 10) + 1;
        const response = await fetch(`https://api.jikan.moe/v4/top/characters?page=${randomPage}&limit=16`);
        const json = await response.json();

        if (!json.data) throw new Error("Jikan API 데이터 수집 실패");

        return json.data.map(char => ({
            name: char.name + ' (캐릭터)',
            image_url: char.images.jpg.image_url
        }));
    } catch (error) {
        console.error("애니메이션 데이터 수집 실패:", error);
        return [];
    }
}

// [기능 2]: 오늘의 랜덤 귀여운 강아지 수집
async function fetchDailyDogs() {
    console.log("🐶 매일밤 Dog CEO API에서 귀여운 강아지 품종들을 수집합니다...");
    try {
        const response = await fetch("https://dog.ceo/api/breeds/image/random/16");
        const json = await response.json();

        if (json.status !== "success") throw new Error("Dog API 호출 실패");

        // 견종 식별 매핑 (간소화)
        const nameMap = { "husky": "허스키", "pomeranian": "포메라니안", "corgi": "웰시 코기", "retriever": "리트리버", "pug": "퍼그", "shiba": "시바견" };

        return json.message.map((imgUrl, index) => {
            const urlParts = imgUrl.split('/');
            const breedRaw = urlParts[urlParts.length - 2].toLowerCase();
            const breedTokens = breedRaw.split('-');
            const mainBreed = breedTokens[0];
            const koreanName = nameMap[mainBreed] || (mainBreed.charAt(0).toUpperCase() + mainBreed.slice(1));

            return {
                name: `기호 ${index + 1}번: ${koreanName}`,
                image_url: imgUrl
            };
        });
    } catch (error) {
        console.error("강아지 데이터 수집 실패:", error);
        return [];
    }
}

// ============================================
// 💾 데이터베이스 주입 (생성) 파이프라인
// ============================================
async function createWorldcup(userId, title, description, items) {
    if (items.length === 0) {
        console.log(`⚠️ 데이터가 비어있어 '${title}' 월드컵 성성을 스킵합니다.`);
        return;
    }

    console.log(`⏳ DB에 '${title}' 카테고리 생성 중...`);
    const { data: cupData, error: cupError } = await supabase
        .from('worldcups')
        .insert([{ title, description, play_count: 0, creator_id: userId }])
        .select()
        .single();

    if (cupError) {
        console.error("❌ 월드컵 카테고리 생성 실패:", cupError.message);
        return;
    }

    const worldcupId = cupData.id;

    const itemsToInsert = items.map(item => ({
        worldcup_id: worldcupId,
        name: item.name,
        image_url: item.image_url
    }));

    const { error: itemsError } = await supabase
        .from('worldcup_items')
        .insert(itemsToInsert);

    if (itemsError) {
        console.error("❌ 월드컵 아이템 삽입 실패:", itemsError.message);
    } else {
        console.log(`✅ '${title}' 데이터 주입 성공! (총 ${items.length}개 후보 생성 완료)\n`);
    }
}

// ============================================
// 🕰️ 메인 워크플로우 통제
// ============================================
async function runAutoPipeline() {
    console.log("\n=============================================");
    console.log(`🚀 [${new Date().toLocaleString()}] 일일 컨텐츠 트롤링 에이전트 작동 시작...`);
    console.log("=============================================\n");

    const userId = await authenticateAgent();
    if (!userId) {
        console.log("에이전트 실행을 중지합니다. 권한 인가를 다시 확인하세요.");
        return;
    }

    // 1. 애니메이션 수집 및 주입
    const animeItems = await fetchDailyAnime();
    const todayStr = new Date().toISOString().split('T')[0];
    await createWorldcup(userId, `🔥 [오늘의 추천 ${todayStr}] 글로벌 인기 애니메이션 월드컵`, `매일 자정에 갱신되는 세계적 인기 애니 캐릭터 이상형 월드컵입니다!`, animeItems);

    // 2. 강아지 수집 및 주입 (순차적인 딜레이: API 에러 방지)
    // await new Promise(r => setTimeout(r, 2000));
    const dogItems = await fetchDailyDogs();
    await createWorldcup(userId, `🐶 [심쿵 주의 ${todayStr}] 오늘의 귀여운 멍멍이 월드컵`, `에이전트가 매일 밤 전 세계에서 수집한 16마리의 귀여운 강아지들!`, dogItems);

    console.log(`🎉 [${new Date().toLocaleString()}] 오늘자 신규 데이터베이스 파이프라인 적재가 모두 성공적으로 완료되었습니다.`);
    console.log("➡️ 메인 플랫폼(localhost:3000)에서 실시간으로 생성된 월드컵들을 확인해보세요!");
}

// ============================================
// ⏱️ 크론 스케줄링 설정 (매일 밤 자정 실행)
// ============================================

// 프로그램을 켜놓으면 매일 밤 12시 0분에 맞춰서 실행됩니다 (Cron 문법: 초 분 시 일 월 요일)
// 즉각 테스트를 원할 경우를 위해 아래 1회 단독 실행 코드를 넣어두었습니다.
const args = process.argv.slice(2);
if (args.includes('--run-now')) {
    console.log(">> 수동 즉시 실행 모드 발동 <<");
    runAutoPipeline();
} else {
    console.log("🤖 일일 컨텐츠 갱신 에이전트(Daemon)가 시작되었습니다.");
    console.log("   - 매일 자정 (00:00)에 Jikan/Dog API에서 신선한 컨텐츠를 서버에 자동으로 주입합니다.");
    console.log("   - 테스트로 지금 바로 실행해보려면 'node daily_agent.js --run-now' 명령어를 사용하세요.\n");

    cron.schedule('0 0 * * *', () => {
        runAutoPipeline();
    });
}
