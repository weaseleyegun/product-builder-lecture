const fetch = require('node-fetch'); // we can just use native fetch if node >= 18. Node 18+ has native fetch. Let's just use native.

async function testWorker() {
    const qId = '25ec315a-751e-4f36-b55a-fd64ed809e1e';
    console.log("1. Fetching quiz (should increment play_count)");
    const r1 = await fetch(`https://quiz-platform-worker.rlaehrjs03.workers.dev/api/quiz-play?id=${qId}&limit=1`);
    const d1 = await r1.json();
    console.log("Play response:", d1.quiz ? "Success" : "Failed");

    console.log("2. Submitting result (should increment stats)");
    const r2 = await fetch(`https://quiz-platform-worker.rlaehrjs03.workers.dev/api/quiz-result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quizId: qId, correctCount: 1, incorrectCount: 2 })
    });
    const d2 = await r2.json();
    console.log("Result response:", d2);
}
testWorker();
