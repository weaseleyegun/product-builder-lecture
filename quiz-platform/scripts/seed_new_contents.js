const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const ytsr = require('ytsr');
const https = require('https');

const envContent = fs.readFileSync('.dev.vars', 'utf-8');
const supabaseUrl = envContent.match(/SUPABASE_URL="(.*?)"/)[1];
const supabaseKey = envContent.match(/SUPABASE_ANON_KEY="(.*?)"/)[1];
const supabase = createClient(supabaseUrl, supabaseKey);

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function getYoutubeVideoId(query) {
    try {
        const filters1 = await ytsr.getFilters(query);
        const filter1 = filters1.get('Type').get('Video');
        if (!filter1 || !filter1.url) {
            const res = await ytsr(query, { limit: 1 });
            return res.items.length > 0 ? res.items[0].id : null;
        }
        const results = await ytsr(filter1.url, { limit: 1 });
        if (results.items.length > 0) return results.items[0].id;
    } catch (e) {
        try {
            const res = await ytsr(query, { limit: 1 });
            return res.items.length > 0 ? res.items[0].id : null;
        } catch (err) {
            console.error("Youtube search error for", query);
        }
    }
    return null;
}

async function getWikiImage(searchName) {
    const rawName = searchName.split(" (")[0];
    const url = `https://ko.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(rawName)}&prop=pageimages&format=json&pithumbsize=500`;
    return new Promise((resolve) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    const pages = json.query.pages;
                    const pageId = Object.keys(pages)[0];
                    if (pageId !== "-1" && pages[pageId].thumbnail) {
                        resolve(pages[pageId].thumbnail.source);
                    } else {
                        resolve(`https://ui-avatars.com/api/?name=${encodeURIComponent(rawName)}&size=500&background=random&color=fff`);
                    }
                } catch (e) { resolve(`https://ui-avatars.com/api/?name=${encodeURIComponent(rawName)}&size=500&background=random&color=fff`); }
            });
        }).on('error', () => resolve(`https://ui-avatars.com/api/?name=${encodeURIComponent(rawName)}&size=500&background=random&color=fff`));
    });
}

function getRandomOptions(correctAnswer, pool, count = 3) {
    let others = pool.filter(n => n !== correctAnswer);
    others = others.sort(() => 0.5 - Math.random());
    return others.slice(0, count);
}

const movieLines = [
    { title: "해바라기", line: "꼭 그렇게 다 가져가야만 속이 후련했냐" },
    { title: "타짜", line: "묻고 더블로 가" },
    { title: "타짜", line: "나 이대 나온 여자야" },
    { title: "베테랑", line: "어이가 없네" },
    { title: "신세계", line: "살려는 드릴게" },
    { title: "부당거래", line: "호의가 계속되면 그게 권리인 줄 알아요" },
    { title: "아저씨", line: "너희들은 내일만 보고 살지" },
    { title: "내부자들", line: "모히또 가서 몰디브 한 잔 할까" },
    { title: "친구", line: "니가 가라 하와이" },
    { title: "달콤한 인생", line: "넌 나에게 모욕감을 줬어" },
    { title: "곡성", line: "뭣이 중헌디" },
    { title: "관상", line: "내가 왕이 될 상인가" },
    { title: "말아톤", line: "초원은 다리는 백만불짜리 다리" },
    { title: "범죄도시", line: "진실의 방으로" },
    { title: "태조 왕건", line: "누구인가 누가 기침소리를 내었어" },
    { title: "야인시대", line: "사딸라" },
    { title: "극한직업", line: "지금까지 이런 맛은 없었다" },
    { title: "기생충", line: "너는 다 계획이 있구나" },
    { title: "친절한 금자씨", line: "너나 잘하세요" }
];

const celebs = [
    "유재석", "강호동", "신동엽", "아이유", "박보검", "공유", "김수현", "전지현", "송혜교", "손예진",
    "현빈", "차은우", "한소희", "김고은", "박서준", "이민호", "수지", "이효리", "남주혁", "김태리"
];

const idols = [
    "카리나 (aespa)", "윈터 (aespa)", "장원영 (IVE)", "안유진 (IVE)", "민지 (NewJeans)", "해린 (NewJeans)", "하니 (NewJeans)", "설윤 (NMIXX)",
    "미연 ((G)I-DLE)", "슈화 ((G)I-DLE)", "지수 (BLACKPINK)", "제니 (BLACKPINK)", "로제 (BLACKPINK)", "리사 (BLACKPINK)", "사나 (TWICE)", "나연 (TWICE)",
    "류진 (ITZY)", "유나 (ITZY)", "예지 (ITZY)", "카즈하 (LE SSERAFIM)", "김채원 (LE SSERAFIM)", "사쿠라 (LE SSERAFIM)", "허윤진 (LE SSERAFIM)", "홍은채 (LE SSERAFIM)",
    "아이린 (Red Velvet)", "조이 (Red Velvet)", "슬기 (Red Velvet)", "웬디 (Red Velvet)", "미나 (TWICE)", "모모 (TWICE)", "쯔위 (TWICE)", "레이 (IVE)"
];

async function run() {
    const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
        email: 'agent@quizrank.com',
        password: 'seed_password_1234!'
    });
    if (authErr) {
        console.error("Auth failed:", authErr.message);
        return;
    }
    const creator_id = authData.user.id;

    console.log("=== 1. 영화/드라마 명대사 퀴즈 ===");
    const { data: movieQuiz, error: err1 } = await supabase.from('quizzes').insert([{
        title: "🎬 영화&드라마 명대사 듣고 제목 맞추기",
        description: "이 명대사가 나온 작품은 무엇일까요?",
        creator_id: creator_id
    }]).select().single();
    if (err1) return console.error("Movie Quiz Create Error:", err1);

    let movieTitles = [...new Set(movieLines.map(m => m.title))];
    let movieDocs = [];
    for (let m of movieLines) {
        let vid = await getYoutubeVideoId(m.title + " " + m.line);
        if (!vid) continue;
        let wrongs = getRandomOptions(m.title, movieTitles, 3);
        let opts = [m.title, ...wrongs].sort(() => 0.5 - Math.random());
        movieDocs.push({
            quiz_id: movieQuiz.id,
            video_id: vid,
            start_time: 0,
            end_time: 15, // just play the clip initially
            answer: m.title,
            options: opts.map((t, idx) => ({ id: ['A', 'B', 'C', 'D'][idx], text: t, isCorrect: t === m.title })),
            is_embeddable: true
        });
        await sleep(1000);
    }
    await supabase.from('quiz_questions').insert(movieDocs);
    console.log(`Inserted ${movieDocs.length} movie questions.`);

    console.log("=== 2. 사진 보고 연예인 맞추기 퀴즈 ===");
    const { data: celebQuiz, error: err2 } = await supabase.from('quizzes').insert([{
        title: "📸 사진 보고 연예인 이름 맞추기 (TOP 20)",
        description: "얼굴만 보고 이름을 맞혀보세요!",
        creator_id: creator_id
    }]).select().single();
    if (err2) return console.error("Celeb Quiz Create Error:", err2);

    let celebDocs = [];
    for (let name of celebs) {
        let imgUrl = await getWikiImage(name);
        let wrongs = getRandomOptions(name, celebs, 3);
        let opts = [name, ...wrongs].sort(() => 0.5 - Math.random());
        celebDocs.push({
            quiz_id: celebQuiz.id,
            video_id: imgUrl, // image url as videoId (quiz.js supports this)
            start_time: 0,
            end_time: 0,
            answer: name,
            options: opts.map((t, idx) => ({ id: ['A', 'B', 'C', 'D'][idx], text: t, isCorrect: t === name })),
            is_embeddable: true
        });
    }
    await supabase.from('quiz_questions').insert(celebDocs);
    console.log(`Inserted ${celebDocs.length} celeb questions.`);

    console.log("=== 3. 여자 아이돌 이상형 월드컵 ===");
    const { data: idolWorldcup, error: err3 } = await supabase.from('worldcups').insert([{
        title: "✨ 2026 여자 아이돌 이상형 월드컵",
        description: "현세대 최고의 여자 아이돌은 누구?",
        creator_id: creator_id
    }]).select().single();
    if (err3) return console.error("Idol Worldcup Create Error:", err3);

    let idolDocs = [];
    for (let idol of idols) {
        let imgUrl = await getWikiImage(idol);
        idolDocs.push({
            worldcup_id: idolWorldcup.id,
            name: idol,
            image_url: imgUrl,
            win_count: 0
        });
    }
    await supabase.from('worldcup_items').insert(idolDocs);
    console.log(`Inserted ${idolDocs.length} idol worldcup items.`);

    console.log("All done!");
}

run();
