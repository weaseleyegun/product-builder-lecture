const ytsr = require('ytsr');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.dev.vars' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

const mapping = {
    // 1. 고전 게임 BGM
    '메이플스토리 (로그인 화면)': '메이플스토리 로그인 bgm 피아노 커버',
    '스타크래프트 (테란 BGM)': '스타크래프트 테란 bgm 피아노',
    '수퍼마리오 (오리지널 코인)': '슈퍼마리오 브금 피아노',
    '크레이지아케이드 (Bnb)': '크레이지아케이드 로비 피아노 커버',
    '포켓몬스터 (전투 BGM)': '포켓몬스터 전투 브금 피아노',
    '카운터 스트라이크': '카운터스트라이크 브금 커버',
    '동물의 숲 (오전 8시)': '동물의숲 오전 8시 피아노',
    '젤다의 전설 (야숨 메인 테마)': '젤다의 전설 야숨 메인테마 피아노',
    '바람의 나라 (타이틀)': '바람의 나라 부여성 피아노 커버',
    '카트라이더 (로비 브금)': '카트라이더 로비 브금 피아노',

    // 2. 싸이월드 BGM
    '프리스타일 - Y': '프리스타일 Y 피아노 커버',
    '버즈 - 가시': '버즈 가시 피아노 커버',
    'SG워너비 - 내사람': 'SG워너비 내사람 피아노',
    '김종국 - 사랑스러워': '김종국 사랑스러워 피아노',
    '에픽하이 - 우산': '에픽하이 우산 피아노 커버',

    // 3. 롤 대사
    '야스오': '리그오브레전드 야스오 대사 모음',
    '가렌': '리그오브레전드 가렌 대사 모음',
    '티모': '리그오브레전드 티모 픽창 대사',
    '징크스': '리그오브레전드 징크스 대사',
    '진': '리그오브레전드 진 대사',
    '리신': '리그오브레전드 리신 대사',
    '블리츠크랭크': '리그오브레전드 블리츠 대사',
};

async function run() {
    await supabase.auth.signInWithPassword({ email: 'agent@quizrank.com', password: 'seed_password_1234!' });

    const { data: qList } = await supabase.from('quiz_questions').select('id, options');

    let cacheCount = 0;
    for (let q of qList) {
        if (!q.options) continue;
        const correctOpt = Array.isArray(q.options) ? q.options.find(o => o.isCorrect) : null;
        if (!correctOpt) continue;

        const keyword = mapping[correctOpt.text];
        if (keyword) {
            console.log(`Searching for: ${keyword}`);
            try {
                const searchResults = await ytsr(keyword, { limit: 3 });
                const video = searchResults.items.find(i => i.type === 'video');
                if (video) {
                    console.log(`  -> Found: ${video.title} (${video.id})`);
                    await supabase.from('quiz_questions')
                        .update({ video_id: video.id, start_time: 10, end_time: 15 })
                        .eq('id', q.id);
                    cacheCount++;
                }
            } catch (err) {
                console.error(`  -> ytsr fail for ${keyword}`);
            }
        }
    }
    console.log(`Updated ${cacheCount} rows!`);
}

run();
