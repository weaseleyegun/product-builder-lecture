import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.dev.vars') });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

function makeOptions(correctAnswer, allAnswers) {
    const letters = ['A', 'B', 'C', 'D'];
    const wrongs = allAnswers.filter(a => a !== correctAnswer).sort(() => Math.random() - 0.5).slice(0, 3);
    const all = [correctAnswer, ...wrongs].sort(() => Math.random() - 0.5);
    return all.map((text, i) => ({ id: letters[i], text, isCorrect: text === correctAnswer }));
}

async function fetchJikanCharacters() {
    let characters = [];
    for (let page = 1; page <= 4; page++) {
        console.log(`Fetching page ${page}...`);
        const res = await fetch(`https://api.jikan.moe/v4/top/characters?page=${page}`);
        const data = await res.json();
        if (data && data.data) {
            for (const char of data.data) {
                if (characters.length >= 100) break;
                // Get name (it's formatted as "Last, First" in Jikan, let's keep it or flip it)
                const nameParts = char.name.split(', ');
                const formattedName = nameParts.length === 2 ? `${nameParts[1]} ${nameParts[0]}` : char.name;

                const imageUrl = char.images?.jpg?.image_url;
                if (imageUrl && !imageUrl.includes('questionmark')) {
                    characters.push({ name: formattedName, url: imageUrl });
                }
            }
        }
        await new Promise(r => setTimeout(r, 1500)); // Respect rate limit
    }
    return characters.slice(0, 100);
}

async function run() {
    console.log('🚀 Jikan API 연동: 애니메이션 캐릭터 이미지 데이터 수집 시작');

    // Auth
    let userId = null;
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: 'agent@quizrank.com',
        password: 'seed_password_1234!'
    });
    if (!authError && authData.user) {
        userId = authData.user.id;
    }

    const characters = await fetchJikanCharacters();
    console.log(`✅ ${characters.length}명의 애니메이션 캐릭터 로드 완료`);

    if (characters.length < 50) return;

    // Create New Quiz
    const quizTitle = '📸 애니메이션 캐릭터 보고 맞추기 (TOP 100)';

    // Check if exists
    let { data: existingQA } = await supabase.from('quizzes').select('id').eq('title', quizTitle).single();
    let quizId = existingQA?.id;

    if (!quizId) {
        const insertData = {
            title: quizTitle,
            description: '세계적으로 인기있는 애니 캐릭터 100명을 엄선! 사진을 보고 이름을 영어/일본어표기로 맞춰보세요.',
        };
        if (userId) insertData.creator_id = userId;

        const { data: newQuiz, error } = await supabase.from('quizzes').insert(insertData).select('id').single();
        if (error) { console.error('퀴즈 생성 실패', error); return; }
        quizId = newQuiz.id;
        console.log(`✅ 새로운 퀴즈 테이블 생성 완료: ${quizId}`);
    } else {
        console.log(`✅ 기존 퀴즈 업데이트 진행: ${quizId}`);
        await supabase.from('quiz_questions').delete().eq('quiz_id', quizId);
    }

    const allAnswers = characters.map(c => c.name);
    const toAdd = characters.map((c, idx) => ({
        quiz_id: quizId,
        video_id: c.url,       // Image URL as videoId
        start_time: 0,
        end_time: 5,           // Doesn't matter for images
        answer: c.name,
        options: makeOptions(c.name, allAnswers),
        is_embeddable: true
    }));

    for (let b = 0; b < toAdd.length; b += 20) {
        const { error } = await supabase.from('quiz_questions').insert(toAdd.slice(b, b + 20));
        if (error) console.error('  배치 실패:', error.message);
    }

    console.log('🎉 애니메이션 캐릭터 100명 퀴즈 완성!');
}

run();
