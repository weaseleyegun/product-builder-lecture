const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const e = fs.readFileSync('.dev.vars', 'utf-8');
const s = createClient(
    e.match(/SUPABASE_URL="(.*?)"/)[1],
    e.match(/SUPABASE_ANON_KEY="(.*?)"/)[1]
);

async function preview() {
    console.log("🔍 DB 일괄 수정 미리보기 분석 중...\n");
    const { data: questions } = await s.from('quiz_questions').select('id, answer, options');

    let allAnswers = Array.from(new Set(questions.map(q => q.answer).filter(Boolean)));

    // 가수 이름 제거 함수
    const removeArtist = (text) => {
        if (!text) return text;
        if (text.includes(' - ')) {
            return text.split(' - ').slice(1).join(' - ').trim();
        }
        return text.trim();
    };

    let badOptionsCount = 0;
    let artistRemoveCount = 0;

    let examples = [];

    questions.forEach(q => {
        if (!q.options) return;

        let needsArtistRemoval = false;
        let isBadOption = false;

        let newAnswer = removeArtist(q.answer);
        if (newAnswer !== q.answer) {
            needsArtistRemoval = true;
            artistRemoveCount++;
        }

        let opts = typeof q.options === 'string' ? JSON.parse(q.options) : q.options;

        let badCount = opts.filter(o => /^[A-Za-z]{1,2}$/.test(o.text) || o.text === 'AdSense').length;
        if (badCount >= 2) {
            isBadOption = true;
            badOptionsCount++;
        }

        if ((needsArtistRemoval || isBadOption) && examples.length < 3) {
            let exampleOpts = opts.map(o => o.text);
            let cleanedOpts = exampleOpts.map(o => removeArtist(o));

            if (isBadOption) {
                cleanedOpts = ["(정상적인 랜덤 노래 제목들로 재구성됨)"];
            }

            examples.push({
                "기존 정답": q.answer,
                "변경 후 정답": newAnswer,
                "기존 보기": exampleOpts.join(', '),
                "변경 후 보기": cleanedOpts.join(', '),
                "버그 보기 포함 여부": isBadOption ? "O" : "X"
            });
        }
    });

    console.log(`✅ [미리보기 결과]`);
    console.log(`- 'A, B, Ad' 등 버그 보기가 있어 재구성이 필요한 문제: ${badOptionsCount}개`);
    console.log(`- '가수 - 노래제목' 포맷이라 가수 제거가 가능한 문제: ${artistRemoveCount}개\n`);

    console.log(`[변경 예시 샘플]`);
    console.table(examples);
}

preview();
