// seed_quizzes.js - Search YouTube, verify embeddability, insert into DB
// Usage: node seed_quizzes.js
// This replaces old broken quiz data with 100 verified entries per category

import { createClient } from '@supabase/supabase-js';
import ytsr from 'ytsr';
import dotenv from 'dotenv';
import path from 'path';

import { JPOP_SONGS } from './seed_data/jpop.js';
import { POP_SONGS } from './seed_data/pop.js';
import { ANIME_SONGS } from './seed_data/anime.js';
import { GAME_SONGS } from './seed_data/game.js';
import { KPOP_SONGS } from './seed_data/kpop.js';

dotenv.config({ path: path.resolve(process.cwd(), '.dev.vars') });

var supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// Check embeddability via oEmbed API
async function isEmbeddable(videoId) {
    try {
        var url = 'https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=' + videoId + '&format=json';
        var res = await fetch(url);
        return res.status === 200;
    } catch (e) { return false; }
}

function delay(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

// Search YouTube and find an embeddable video
async function findEmbeddableVideo(searchQuery) {
    try {
        var results = await ytsr(searchQuery, { limit: 5 });
        var videos = results.items.filter(function (i) { return i.type === 'video'; });

        for (var v of videos) {
            if (await isEmbeddable(v.id)) {
                return { id: v.id, duration: v.duration };
            }
            await delay(300);
        }
        return null;
    } catch (e) {
        return null;
    }
}

// Parse duration string "M:SS" to seconds
function parseDuration(durStr) {
    if (!durStr) return 120;
    var parts = durStr.split(':').map(Number);
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return 120;
}

// Pick a good playback segment (30-60% into the song, 5 second clip)
function pickSegment(durationStr) {
    var totalSec = parseDuration(durationStr);
    var start = Math.floor(totalSec * 0.3) + Math.floor(Math.random() * Math.floor(totalSec * 0.2));
    start = Math.max(10, Math.min(start, totalSec - 10));
    return { start: start, end: start + 5 };
}

// Generate 4 quiz options (1 correct + 3 random wrong from same category)
function makeOptions(correctAnswer, allAnswers) {
    var wrongs = allAnswers.filter(function (a) { return a !== correctAnswer; });
    // Shuffle and pick 3
    wrongs.sort(function () { return Math.random() - 0.5; });
    var selected = wrongs.slice(0, 3);
    selected.push(correctAnswer);
    // Shuffle all 4
    selected.sort(function () { return Math.random() - 0.5; });
    return selected.map(function (text, i) {
        var ids = ['A', 'B', 'C', 'D'];
        return { id: ids[i], text: text, isCorrect: text === correctAnswer };
    });
}

// Process one quiz category
async function processCategory(userId, quizTitle, quizDesc, songs) {
    console.log('\n========================================');
    console.log('🎵 ' + quizTitle + ' 처리 시작 (' + songs.length + '곡)');
    console.log('========================================\n');

    var allAnswers = songs.map(function (s) { return s[1]; });
    var questionsToInsert = [];
    var failCount = 0;

    for (var i = 0; i < songs.length; i++) {
        var searchQuery = songs[i][0];
        var correctAnswer = songs[i][1];

        process.stdout.write('  [' + (i + 1) + '/' + songs.length + '] ' + correctAnswer + ' ... ');

        var video = await findEmbeddableVideo(searchQuery);
        if (!video) {
            console.log('❌ 임베드 가능한 영상 없음');
            failCount++;
            await delay(500);
            continue;
        }

        var seg = pickSegment(video.duration);
        var options = makeOptions(correctAnswer, allAnswers);

        questionsToInsert.push({
            video_id: video.id,
            start_time: seg.start,
            end_time: seg.end,
            answer: correctAnswer,
            options: options,
            is_embeddable: true
        });

        console.log('✅ ' + video.id + ' (' + seg.start + '-' + seg.end + 's)');
        await delay(800); // Rate limit for ytsr
    }

    if (questionsToInsert.length === 0) {
        console.log('⚠️ 삽입할 문제가 없습니다.');
        return;
    }

    // Create quiz entry in DB
    var { data: quizData, error: quizError } = await supabase
        .from('quizzes')
        .insert([{ title: quizTitle, description: quizDesc, play_count: 0, creator_id: userId }])
        .select()
        .single();

    if (quizError) {
        console.error('❌ 퀴즈 생성 실패:', quizError.message);
        return;
    }

    // Attach quiz_id to all questions
    var toInsert = questionsToInsert.map(function (q) {
        q.quiz_id = quizData.id;
        return q;
    });

    // Insert in batches of 20
    for (var b = 0; b < toInsert.length; b += 20) {
        var batch = toInsert.slice(b, b + 20);
        var { error: insertErr } = await supabase.from('quiz_questions').insert(batch);
        if (insertErr) {
            console.error('❌ 배치 삽입 실패:', insertErr.message);
        }
    }

    console.log('\n✅ "' + quizTitle + '" 완료! ' + questionsToInsert.length + '/' + songs.length + '개 문제 추가 (실패: ' + failCount + ')');
    return quizData.id;
}

// Main
async function main() {
    console.log('🚀 퀴즈 데이터 대량 시딩 시작!\n');

    // Authenticate and get user ID for RLS
    var { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: 'agent@quizrank.com',
        password: 'seed_password_1234!'
    });

    if (authError || !authData.user) {
        console.error('❌ 인증 실패:', authError ? authError.message : 'user not found');
        return;
    }
    var userId = authData.user.id;
    console.log('✅ 인증 완료 (User ID: ' + userId + ')\n');

    var categories = [
        ['🇯🇵 J-POP 명곡 100선', '일본 팝 노래 5초 듣고 맞추기!', JPOP_SONGS],
        ['🎤 K-POP 히트곡 100선', 'K-POP 명곡 5초 듣고 맞추기!', KPOP_SONGS],
        ['🌍 빌보드 팝송 100선', '전 세계 팝송 5초 듣고 맞추기!', POP_SONGS],
        ['🎬 애니메이션 OST 100선', '애니 주제곡 5초 듣고 맞추기!', ANIME_SONGS],
        ['🎮 게임 브금(BGM) 100선', '게임 음악 5초 듣고 맞추기!', GAME_SONGS],
    ];

    for (var cat of categories) {
        await processCategory(userId, cat[0], cat[1], cat[2]);
        await delay(2000);
    }

    console.log('\n🎉 모든 카테고리 시딩 완료!');
}

main();
