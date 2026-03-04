import OpenAI from 'openai';

/**
 * 프롬프트와 예시를 기반으로 퀴즈 데이터를 생성합니다.
 * @param {string} prompt - 사용자가 입력한 주제 (예: "2000년대 싸이월드 BGM")
 * @param {string} example - 예시 데이터 (예: "에픽하이 - LoveLoveLove")
 * @param {number} count - 수집할 개수
 * @returns {Promise<Array>} - 생성된 퀴즈 아이템 배열
 */
export async function generateQuizData(prompt, example, count) {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const systemPrompt = `당신은 퀴즈 플랫폼의 데이터를 대량으로 생성하는 전문가 AI입니다.
사용자가 제공한 "주제(Prompt)"와 "예시(Example)"의 관계를 분석하여, 그와 정확히 동일한 형식과 무드를 가진 퀴즈 정답(아이템)을 만들어야 합니다.
다양성을 위해 유명한 것부터 적당히 알려진 것까지 다양하게 포함하세요.

반드시 \`{ "items": [ ... ] }\` 형식의 JSON 객체로 응답해야 합니다.
각 아이템 항목은 다음 필드를 포함해야 합니다:
- "answer": 퀴즈의 정답 텍스트 (예: "에픽하이 - Love, Love, Love")
- "searchQuery": 이 정답을 유튜브에서 검색할 때, 가장 적절한 클립이나 음원, 뮤비 등이 최상단에 나올 만한 최적의 검색어 (예: "에픽하이 Love Love Love 교차편집" 혹은 "아이언맨 I am iron man 명장면")
- "hint": 유저에게 보여줄 수 있는 짧은 힌트 텍스트 (선택사항, 없으면 빈 문자열)

총 ${count}개의 고유한(중복 없는) 데이터를 반환하세요.`;

    const userPrompt = `주제: ${prompt}\n예시: ${example}\n\n위 주제와 예시에 부합하는 퀴즈 데이터 ${count}개를 JSON으로 생성해주세요.`;

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            response_format: { type: "json_object" },
        });

        const parsed = JSON.parse(response.choices[0].message.content);
        return parsed.items || [];
    } catch (error) {
        console.error("OpenAI API API (퀴즈 생성) 호출 에러:", error);
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
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const sampleKeywords = items.slice(0, 5).map(item => item.answer).join(', ');

    const systemPrompt = `당신은 바이럴 마케팅 전문가입니다.
사용자가 퀴즈 플랫폼(또는 이상형 월드컵)을 만들고 있습니다. 다음 주제와 예시 데이터들을 보고, 사람들이 클릭하고 싶어지는 자극적이고 흥미로운 제목 5개를 추천해주세요.
단, 어조는 가볍고 친근해야 하며, 너무 딱딱하지 않아야 합니다.

반드시 \`{ "titles": [ "제목1", "제목2", ... ] }\` 형태의 JSON으로 반환하세요.`;

    const userPrompt = `주제: ${prompt}\n포함된 데이터 예시: ${sampleKeywords}`;

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            response_format: { type: "json_object" },
        });

        const parsed = JSON.parse(response.choices[0].message.content);
        return parsed.titles || [];
    } catch (error) {
        console.error("OpenAI API (제목 추천) 호출 에러:", error);
        throw error;
    }
}
