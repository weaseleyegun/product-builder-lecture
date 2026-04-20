import { GoogleGenerativeAI } from '@google/generative-ai';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .dev.vars from quiz-platform and .env from root
dotenv.config({ path: path.join(__dirname, '..', '.dev.vars') });
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * 프롬프트와 예시를 기반으로 퀴즈 데이터를 생성합니다.
 * @param {string} prompt - 사용자가 입력한 주제 (예: "2000년대 싸이월드 BGM")
 * @param {string} example - 예시 데이터 (예: "에픽하이 - LoveLoveLove")
 * @param {number} count - 수집할 개수
 * @returns {Promise<Array>} - 생성된 퀴즈 아이템 배열
 */
export async function generateQuizData(prompt, example, count) {
    const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash",
        generationConfig: { responseMimeType: "application/json" }
    });

    const systemPrompt = `당신은 퀴즈 플랫폼의 데이터를 대량으로 생성하는 전문가 AI입니다.
사용자가 제공한 "주제(Prompt)"와 "예시(Example)"의 관계를 분석하여, 그와 정확히 동일한 형식과 무드를 가진 퀴즈 정답(아이템)을 만들어야 합니다.
다양성을 위해 유명한 것부터 적당히 알려진 것까지 다양하게 포함하세요.

🔥 [가장 중요한 규칙 (CRITICAL)] 🔥
모든 정답("answer" 필드)은 외국어 노래/콘텐츠일지라도 절대 원어나 영문 그대로 기입하지 말고, 반드시 "국내 음원 사이트 및 정식 발매 기준의 공식 한국어 텍스트" 단 하나로만 작성해야 합니다. 정식 발매명을 알 수 없다면 가장 널리 통용되는 한국어 발음을 기입하세요.

반드시 \`{ "items": [ ... ] }\` 형식의 JSON 객체로 응답해야 합니다.
각 아이템 항목은 다음 필드를 포함해야 합니다:
- "answer": 항상 공식 한국어 발매명으로 작성된 퀴즈의 정답 텍스트 (예: "As You Like It" → "마음에 드시는 대로")
- "searchQuery": 이 정답을 유튜브에서 검색할 때, 가장 적절한 클립이나 음원, 뮤비 등이 최상단에 나올 만한 최적의 검색어 (유튜브 검색은 원어가 유리할 수 있으니 원어/영어와 가수를 같이 포함해도 됨)
- "hint": 유저에게 보여줄 수 있는 짧은 힌트 텍스트 (선택사항, 없으면 빈 문자열)

총 ${count}개의 고유한(중복 없는) 데이터를 반환하세요.`;

    const userPrompt = `주제: ${prompt}\n예시: ${example}\n\n위 주제와 예시에 부합하는 퀴즈 데이터 ${count}개를 JSON으로 생성해주세요.`;

    try {
        const result = await model.generateContent(`${systemPrompt}\n\n${userPrompt}`);
        const responseText = result.response.text();
        const parsed = JSON.parse(responseText);
        return parsed.items || [];
    } catch (error) {
        console.error("Gemini API (퀴즈 생성) 호출 에러:", error);
        throw error;
    }
}

/**
 * 수집된 데이터를 바탕으로 매력적인 퀴즈/월드컵 제목 5개를 추천합니다.
 * @param {string} prompt - 원래 주제
 * @param {Array} items - 생성된 데이터 일부
 * @returns {Promise<Array<string>>} - 추천 제목 배열 (최대 5개)
 */
export async function generateTitles(prompt, items) {
    const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash",
        generationConfig: { responseMimeType: "application/json" }
    });
    const sampleKeywords = items.slice(0, 5).map(item => item.answer).join(', ');

    const systemPrompt = `당신은 바이럴 마케팅 전문가입니다.
사용자가 퀴즈 플랫폼(또는 이상형 월드컵)을 만들고 있습니다. 다음 주제와 예시 데이터들을 보고, 사람들이 클릭하고 싶어지는 자극적이고 흥미로운 제목 5개를 추천해주세요.
단, 어조는 가볍고 친근해야 하며, 너무 딱딱하지 않아야 합니다.

반드시 \`{ "titles": [ "제목1", "제목2", ... ] }\` 형태의 JSON으로 반환하세요.`;

    const userPrompt = `주제: ${prompt}\n포함된 데이터 예시: ${sampleKeywords}`;

    try {
        const result = await model.generateContent(`${systemPrompt}\n\n${userPrompt}`);
        const responseText = result.response.text();
        const parsed = JSON.parse(responseText);
        return parsed.titles || [];
    } catch (error) {
        console.error("Gemini API (제목 추천) 호출 에러:", error);
        throw error;
    }
}
