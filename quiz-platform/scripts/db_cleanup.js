const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const e = fs.readFileSync('.dev.vars', 'utf-8');
const supabase = createClient(
    e.match(/SUPABASE_URL="(.*?)"/)[1],
    e.match(/SUPABASE_ANON_KEY="(.*?)"/)[1]
);

// 가수 이름 제거 함수
const removeArtist = (text) => {
    if (!text) return text;
    if (text.includes(' - ')) {
        return text.split(' - ').slice(1).join(' - ').trim();
    }
    return text.trim();
};

async function cleanup() {
    console.log("🚀 DB 일괄 클린업 시작...\n");
    const { data: questions, error } = await supabase.from('quiz_questions').select('id, answer, options, quiz_id');

    if (error) {
        console.error("데이터 조회 실패:", error);
        return;
    }

    // 존재하는 모든 정답(가수 제외본) 모음집 생성
    let allCleanAnswers = Array.from(new Set(
        questions.map(q => removeArtist(q.answer)).filter(Boolean)
    ));

    let updatedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        if (!q.options) continue;

        let needsUpdate = false;

        // 정답 정제
        let newAnswer = removeArtist(q.answer);
        if (newAnswer !== q.answer) {
            needsUpdate = true;
        }

        let opts = typeof q.options === 'string' ? JSON.parse(q.options) : q.options;

        // 이상한 보기 검열 (A, B, C, Ad 등)
        let isBadOption = false;
        let badCount = opts.filter(o => /^[A-Za-z]{1,2}$/.test(o.text) || o.text === 'AdSense').length;
        if (badCount >= 2 || opts.length < 2) {
            isBadOption = true;
            needsUpdate = true;
        } else {
            // 보기 내의 가수 이름도 전부 제거 여부 확인
            opts.forEach(o => {
                let cleanedText = removeArtist(o.text);
                if (cleanedText !== o.text) {
                    o.text = cleanedText;
                    needsUpdate = true;
                }
            });
        }

        // 보기가 망가진 경우, DB의 전체 정답들을 기준으로 무작위 동적 할당
        if (isBadOption) {
            let wrongs = allCleanAnswers.filter(a => a !== newAnswer).sort(() => Math.random() - 0.5).slice(0, 3);
            let newOpts = [newAnswer, ...wrongs].sort(() => Math.random() - 0.5);
            opts = newOpts.map((text, idx) => ({
                id: ['A', 'B', 'C', 'D'][idx],
                text: text,
                isCorrect: text === newAnswer
            }));
        }

        // 정답을 맞춘 옵션의 text가 newAnswer가 되도록 보정 (가수명 제거된 경우 등)
        let correctOpt = opts.find(o => o.isCorrect);
        if (correctOpt && correctOpt.text !== newAnswer) {
            correctOpt.text = newAnswer;
            needsUpdate = true;
        }

        if (needsUpdate) {
            const { error: updateErr } = await supabase
                .from('quiz_questions')
                .update({
                    answer: newAnswer,
                    options: opts
                })
                .eq('id', q.id);

            if (updateErr) {
                console.error(`❌ 업데이트 실패 (${q.id}):`, updateErr.message);
                failedCount++;
            } else {
                updatedCount++;
                process.stdout.write(`\r✅ 진행률: ${updatedCount}개 업데이트 완료...`);
            }
        }
    }

    console.log(`\n\n🎉 DB 클린업 완료! 총 ${updatedCount}개 항목이 성공적으로 수정되었습니다. (실패: ${failedCount})`);
}

cleanup();
