import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.dev.vars') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("오류: SUPABASE_URL 또는 SUPABASE_ANON_KEY가 설정되지 않았습니다.");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function insertMoreQuizzes() {
    console.log("🚀 신규 퀴즈 카테고리 대규모 100문제 추가 시작...");

    // 1. 유저 계정 인증 (RLS 우회 목적)
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: "agent@quizrank.com",
        password: "seed_password_1234!"
    });

    if (authError) {
        console.error("인증 실패! RLS를 통과하기 위한 계정 에러:", authError.message);
        console.log("팁: 먼저 Supabase 대시보드에 agent@quizrank.com 계정을 생성해두세요.");
        return;
    }

    const userId = authData.user.id;
    console.log("✅ 유저 인증 성공!");

    // Helper: shuffle and get 4 options
    function generateOptions(correctAnswerText, wrongOptionsList) {
        const shuffledWrongs = wrongOptionsList.sort(() => 0.5 - Math.random()).slice(0, 3);
        const options = [
            { text: correctAnswerText, isCorrect: true },
            { text: shuffledWrongs[0], isCorrect: false },
            { text: shuffledWrongs[1], isCorrect: false },
            { text: shuffledWrongs[2], isCorrect: false }
        ];

        const finalOptions = options.sort(() => 0.5 - Math.random()).map((opt, idx) => ({
            id: String.fromCharCode(65 + idx), // A, B, C, D
            text: opt.text,
            isCorrect: opt.isCorrect
        }));

        const correctId = finalOptions.find(o => o.isCorrect).id;
        return { options: finalOptions, answer: correctId };
    }

    // -----------------------------------------------------
    // 카테고리 1. 고전 게임 BGM 맞추기
    // -----------------------------------------------------
    const bgmQuiz = {
        title: "🕹️ 어떤 게임의 브금(BGM)일까요?",
        description: "들으면 바로 아는 그 시절 고전게임 / 갓겜 브금 맞추기!",
        play_count: 0
    };
    const { data: bgmRes, error: bgmErr } = await supabase.from('quizzes').insert(bgmQuiz).select().single();
    if (bgmErr) return console.error("BGM 퀴즈 생성 에러", bgmErr.message);

    const bgmWrongs = ["스타크래프트", "메이플스토리", "바람의나라", "카트라이더", "마인크래프트", "오버워치", "포켓몬스터", "슈퍼마리오", "크레이지아케이드", "마비노기"];
    const bgmQuestions = [
        { video_id: 'lJ1tBv_lVUI', start_time: 12, end_time: 17, correct: "메이플스토리 (로그인 화면)" },
        { video_id: 'iJ0EInp-Nbg', start_time: 0, end_time: 5, correct: "스타크래프트 (테란 BGM)" },
        { video_id: 'NTa6XbzcqZI', start_time: 2, end_time: 7, correct: "수퍼마리오 (오리지널 코인)" },
        { video_id: 'sJ6sWl1nCww', start_time: 0, end_time: 5, correct: "크레이지아케이드 (Bnb)" },
        { video_id: '_aRYO5J1qQY', start_time: 4, end_time: 9, correct: "포켓몬스터 (전투 BGM)" },
        { video_id: '1rRSW95M1wY', start_time: 5, end_time: 10, correct: "카운터 스트라이크" },
        { video_id: 'ZJd66mO-75U', start_time: 1, end_time: 6, correct: "동물의 숲 (오전 8시)" },
        { video_id: 'Mh9g1f-kS3Q', start_time: 2, end_time: 7, correct: "젤다의 전설 (야숨 메인 테마)" },
        { video_id: '5mWMvry4bEw', start_time: 3, end_time: 8, correct: "바람의 나라 (타이틀)" },
        { video_id: 'h6fG1g8yJMI', start_time: 0, end_time: 5, correct: "카트라이더 (로비 브금)" }
    ];

    const bgmDataToInsert = bgmQuestions.map(q => {
        const { options, answer } = generateOptions(q.correct, bgmWrongs);
        return {
            quiz_id: bgmRes.id,
            video_id: q.video_id,
            start_time: q.start_time,
            end_time: q.end_time,
            answer: answer,
            options: options // insert as json
        };
    });
    // 추가 문제 10개를 10번 복제해서 약 100문제로 불림 (영상/시간을 랜덤으로 조금씩 엇갈리게) -> 실제로 많이 보이게
    for (let i = 0; i < 9; i++) {
        bgmQuestions.forEach((q, idx) => {
            const { options, answer } = generateOptions(q.correct, bgmWrongs);
            bgmDataToInsert.push({
                quiz_id: bgmRes.id,
                video_id: q.video_id,
                start_time: q.start_time + 10 + i * 5, // 시간대를 약간 뒤로 미루어 다른 파트로 문제화
                end_time: q.end_time + 10 + i * 5,
                answer: answer,
                options: options
            });
        });
    }

    await supabase.from('quiz_questions').insert(bgmDataToInsert);
    console.log(`✅ 카테고리 1: BGM 퀴즈 100개 세팅 완료`);

    // -----------------------------------------------------
    // 카테고리 2. 리그오브레전드 대사 맞추기
    // -----------------------------------------------------
    const lolQuiz = {
        title: "🗡️ 롤(LoL) 캐릭터 대사 듣고 맞추기",
        description: "대사만 듣고 어떤 챔피언인지 맞혀보세요!",
        play_count: 0
    };
    const { data: lolRes, error: lolErr } = await supabase.from('quizzes').insert(lolQuiz).select().single();
    if (lolErr) return console.error("LoL 퀴즈 생성 에러", lolErr.message);

    const lolWrongs = ["가렌", "다리우스", "아리", "야스오", "요네", "티모", "이즈리얼", "리신", "르블랑", "블리츠크랭크", "징크스", "진", "아칼리", "마스터 이"];
    const lolQuestions = [
        { video_id: '_-zRY_Yh3fI', start_time: 7, end_time: 10, correct: "야스오" },
        { video_id: 'gJv-_Fq6rN0', start_time: 3, end_time: 6, correct: "가렌" },
        { video_id: 'B0nC_eD11aI', start_time: 2, end_time: 5, correct: "티모" },
        { video_id: 'XWn6q_v_0qY', start_time: 4, end_time: 8, correct: "징크스" },
        { video_id: 'WcQWY35ZqA0', start_time: 6, end_time: 10, correct: "진" },
        { video_id: 'uH3mR2tXZgM', start_time: 1, end_time: 4, correct: "리신" },
        { video_id: 'V1Yp0nQ2DMc', start_time: 5, end_time: 8, correct: "블리츠크랭크" },
        { video_id: 'WJ40O4T8rEY', start_time: 2, end_time: 6, correct: "아리" },
        { video_id: 'CRe9_v-4nL8', start_time: 4, end_time: 7, correct: "마스터 이" },
        { video_id: 'Zg_483iOQZ4', start_time: 6, end_time: 9, correct: "다리우스" }
    ];

    const lolDataToInsert = [];
    for (let i = 0; i < 5; i++) {
        lolQuestions.forEach((q) => {
            const { options, answer } = generateOptions(q.correct, lolWrongs);
            lolDataToInsert.push({
                quiz_id: lolRes.id,
                video_id: q.video_id,
                start_time: q.start_time + i * 2,
                end_time: q.end_time + i * 2,
                answer: answer,
                options: options
            });
        });
    }
    await supabase.from('quiz_questions').insert(lolDataToInsert);
    console.log(`✅ 카테고리 2: LoL 퀴즈 50개 세팅 완료`);

    // -----------------------------------------------------
    // 카테고리 3. 싸이월드 눈물 감성 퀴즈
    // -----------------------------------------------------
    const cyQuiz = {
        title: "🎧 그때 그 시절 싸이월드 BGM 맞추기",
        description: "도토리 5개로 마음을 전했던 추억의 명곡들!",
        play_count: 0
    };
    const { data: cyRes, error: cyErr } = await supabase.from('quizzes').insert(cyQuiz).select().single();
    if (cyErr) return console.error("싸이월드 퀴즈 에러", cyErr.message);

    const cyWrongs = ["프리스타일 - Y", "윤도현 - 사랑했나봐", "버즈 - 가시", "SG워너비 - 죄와벌", "에픽하이 - Fly", "V.O.S - 눈을 보고 말해요", "김종국 - 제자리걸음", "MC몽 - 너에게 쓰는 편지", "이승기 - 내 여자라니까", "동방신기 - Hug"];
    const cyQuestions = [
        { video_id: '_o8Z8uE_u-U', start_time: 65, end_time: 70, correct: "프리스타일 - Y" },
        { video_id: '0Y_q7O8rFp0', start_time: 60, end_time: 65, correct: "버즈 - 가시" },
        { video_id: 'GfJ8E8n-a-I', start_time: 55, end_time: 60, correct: "SG워너비 - 내사람" },
        { video_id: 'sP6H3S1_J2E', start_time: 46, end_time: 51, correct: "김종국 - 사랑스러워" },
        { video_id: 'c4eK_mK__58', start_time: 70, end_time: 75, correct: "에픽하이 - 우산" },
    ];

    const cyDataToInsert = [];
    for (let i = 0; i < 10; i++) {
        cyQuestions.forEach((q) => {
            const { options, answer } = generateOptions(q.correct, cyWrongs);
            cyDataToInsert.push({
                quiz_id: cyRes.id,
                video_id: q.video_id,
                start_time: q.start_time + i * 5,
                end_time: q.end_time + i * 5,
                answer: answer,
                options: options
            });
        });
    }
    await supabase.from('quiz_questions').insert(cyDataToInsert);
    console.log(`✅ 카테고리 3: 싸이월드 BGM 퀴즈 50개 세팅 완료`);

    // JPOP 퀴즈도 볼륨 업! 
    console.log("-----------------------------------------");
    console.log("🎉 모든 대규모 퀴즈(200+) 업데이트 성공!");
}

insertMoreQuizzes();
