import { createClient } from '@supabase/supabase-js';
import ytsr from 'ytsr';
import dotenv from 'dotenv';
import path from 'path';
import { UTAITE_SONGS } from './seed_data/utaite.js';

dotenv.config({ path: path.resolve(process.cwd(), '.dev.vars') });

var supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function isEmbeddable(videoId) {
    try {
        var url = 'https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=' + videoId + '&format=json';
        var res = await fetch(url);
        return res.status === 200;
    } catch (e) { return false; }
}

function delay(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

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

function parseDuration(durStr) {
    if (!durStr) return 120;
    var parts = durStr.split(':').map(Number);
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return 120;
}

function pickSegment(durationStr) {
    var totalSec = parseDuration(durationStr);
    var start = Math.floor(totalSec * 0.3) + Math.floor(Math.random() * Math.floor(totalSec * 0.2));
    start = Math.max(10, Math.min(start, totalSec - 10));
    return { start: start, end: start + 5 };
}

function makeOptions(correctAnswer, allAnswers) {
    var wrongs = allAnswers.filter(function (a) { return a !== correctAnswer; });
    wrongs.sort(function () { return Math.random() - 0.5; });
    var selected = wrongs.slice(0, 3);
    selected.push(correctAnswer);
    selected.sort(function () { return Math.random() - 0.5; });
    return selected.map(function (text, i) {
        var ids = ['A', 'B', 'C', 'D'];
        return { id: ids[i], text: text, isCorrect: text === correctAnswer };
    });
}

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
        await delay(800);
    }

    if (questionsToInsert.length === 0) {
        console.log('⚠️ 삽입할 문제가 없습니다.');
        return;
    }

    var { data: quizData, error: quizError } = await supabase
        .from('quizzes')
        .insert([{ title: quizTitle, description: quizDesc, play_count: 0, creator_id: userId }])
        .select()
        .single();

    if (quizError) {
        console.error('❌ 퀴즈 생성 실패:', quizError.message);
        return;
    }

    var toInsert = questionsToInsert.map(function (q) {
        q.quiz_id = quizData.id;
        return q;
    });

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

async function main() {
    console.log('🚀 우타이테 데이터만 시딩 시작!\n');
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

    await processCategory(userId, '🎤 우타이테/얼굴없는 가수 명곡 선발', 'Ado, yama, natori, Eve 등 얼굴 없는 일본 가수의 인기곡 100선을 모았습니다!', UTAITE_SONGS);
    console.log('\n🎉 시딩 완료!');
}

main();
