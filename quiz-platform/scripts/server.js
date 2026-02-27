// [2단계] AI 자동 콘텐츠 생성 백엔드 로직 (Node.js & Express & node-cron)
// "AI가 매일 자동으로 '오늘의 J-POP 100' 같은 주제로 문제를 생성하는 백엔드 로직"

const express = require('express');
const cron = require('node-cron');
const axios = require('axios'); // For YouTube API calls
require('dotenv').config();

const app = express();
app.use(express.json());

// 모의 데이터베이스 구조
const db = {
    quizzes: [],
    worldcups: []
};

// Gemini AI 호출 시뮬레이션 함수
const generateTrendKeywordsWithGemini = async () => {
    // 실제 환경에서는 @google/generative-ai 를 사용하여 트렌드 키워드 추출
    console.log('[AI] 제미나이를 통해 오늘(2026-02-23) 트렌드 키워드 추출 중...');
    return ["2026년 인기 애니메이션 OST", "현재 빌보드 핫100 탑 10"];
};

// YouTube API 연동 (노래 맞추기 자동 생성 로직)
const fetchYouTubeVideosForQuiz = async (keyword) => {
    console.log(`[YouTube API] '${keyword}' 와 연관된 동영상 검색 및 파싱 중...`);
    // YouTube Data API v3 호출하여 재생 구간(startSeconds) 할당 로직 구상
    return [
        { title: "인기 애니메이션 오프닝 A", videoId: "xyz123", startTime: 30, endTime: 45 },
        { title: "빌보드 인기곡 B", videoId: "abc456", startTime: 15, endTime: 25 },
    ];
};

// 3. 구체적인 개발 및 운영 계획 - 1) AI 자동 콘텐츠 생성 (Daily Update)
// 매일 아침 06:00 에 자동 실행 (Cron Job)
cron.schedule('0 6 * * *', async () => {
    console.log('⏰ [Cron] 매일 아침 콘텐츠 업데이트 배치 작업 시작...');

    try {
        // Step 1: 제미나이 AI 트렌드 키워드 생성
        const keywords = await generateTrendKeywordsWithGemini();

        for (const keyword of keywords) {
            // Step 2: 키워드 기반 유튜브 데이터 혹은 이미지 파싱
            const quizData = await fetchYouTubeVideosForQuiz(keyword);

            // Step 3: DB에 퀴즈 추가 (자동화)
            const newQuiz = {
                id: Date.now() + Math.random(),
                title: `오늘의 ${keyword} 퀴즈`,
                type: 'youtube-interval', // 객관식 / 주관식 등 속성 지원
                questions: quizData,
                createdAt: new Date()
            };
            db.quizzes.push(newQuiz);
            console.log(`✅ [DB Insert 성공] ${newQuiz.title} 등록 완료.`);
        }
    } catch (error) {
        console.error('❌ 자동 생성 실패:', error);
    }
});

// API Routes (Frontend <-> Backend)
app.get('/api/daily-quiz', (req, res) => {
    res.json(db.quizzes);
});

// 3. 구체적인 개발 및 운영 계획 - 2) 사용자 참여형 에코시스템 (생성 툴 API)
app.post('/api/user-created-content', (req, res) => {
    // 사용자가 직접 월드컵이나 퀴즈를 만들 수 있는 API
    // 게이미피케이션 요소 포함: 사용자에게 포인트나 뱃지 부여
    const content = req.body;
    db.worldcups.push(content);

    res.json({ message: "성공적으로 생성되었습니다! +50 포인트 획득!", data: content });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
});  
