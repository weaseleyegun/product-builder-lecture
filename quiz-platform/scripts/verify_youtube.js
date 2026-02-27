// verify_youtube.js - Check all quiz video IDs for embed availability
// Usage: node verify_youtube.js

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.dev.vars') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// Check if a YouTube video is embeddable using oEmbed API
async function isEmbeddable(videoId) {
    try {
        const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
        const response = await fetch(url);

        if (response.status === 200) {
            return true;  // Video exists and is embeddable
        }
        if (response.status === 401 || response.status === 403) {
            return false; // Embedding disabled or restricted
        }
        return false; // 404 = deleted/private, other = unknown issue
    } catch (error) {
        console.error(`  ⚠️ Network error checking ${videoId}:`, error.message);
        return false;
    }
}

// Add delay between API calls to avoid rate limiting
function delay(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

async function run() {
    console.log('🔍 YouTube 임베드 검증 시작...\n');

    // Authenticate as agent for write access
    await supabase.auth.signInWithPassword({
        email: 'agent@quizrank.com',
        password: 'seed_password_1234!'
    });

    // Fetch all quiz questions
    const { data: questions, error } = await supabase
        .from('quiz_questions')
        .select('id, video_id, answer, options');

    if (error) {
        console.error('❌ DB 조회 실패:', error.message);
        return;
    }

    console.log(`📊 총 ${questions.length}개 문제를 검증합니다.\n`);

    var embeddableCount = 0;
    var blockedCount = 0;
    var blockedList = [];

    for (var i = 0; i < questions.length; i++) {
        var q = questions[i];
        var canEmbed = await isEmbeddable(q.video_id);

        // Get question title from options for display
        var correctOpt = '';
        if (q.options && Array.isArray(q.options)) {
            var found = q.options.find(function (o) { return o.isCorrect; });
            if (found) correctOpt = found.text;
        }

        if (canEmbed) {
            console.log(`  ✅ [${i + 1}/${questions.length}] ${q.video_id} — 임베드 가능 (${correctOpt})`);
            embeddableCount++;
        } else {
            console.log(`  ❌ [${i + 1}/${questions.length}] ${q.video_id} — 임베드 불가! (${correctOpt})`);
            blockedCount++;
            blockedList.push({ id: q.id, video_id: q.video_id, answer: correctOpt });
        }

        // Update DB with embeddable status
        await supabase
            .from('quiz_questions')
            .update({ is_embeddable: canEmbed })
            .eq('id', q.id);

        // Rate limit: 500ms delay between checks
        await delay(500);
    }

    console.log('\n============================================');
    console.log('📊 검증 결과 요약:');
    console.log(`  ✅ 임베드 가능: ${embeddableCount}개`);
    console.log(`  ❌ 임베드 불가: ${blockedCount}개`);
    console.log('============================================\n');

    if (blockedList.length > 0) {
        console.log('🚫 임베드 불가 영상 목록:');
        blockedList.forEach(function (item) {
            console.log(`  - ${item.video_id} (정답: ${item.answer})`);
        });
        console.log('\n💡 이 영상들은 is_embeddable = false로 표시되어 퀴즈에서 자동 제외됩니다.');
    }
}

run();
