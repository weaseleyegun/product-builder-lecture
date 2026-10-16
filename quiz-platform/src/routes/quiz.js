// quiz.js - Quiz API route handlers

import { jsonResponse, errorResponse } from '../helpers/cors.js';
import { parsePaging, withThumbUrl, childCount, stripKey } from '../helpers/list.js';

// GET /api/daily-quiz?sort=rank|latest|correct_asc|correct_desc&limit=100&offset=0  (published, 문제가 1개 이상인 퀴즈만)
async function handleDailyQuiz(url, supabase) {
    const sort = url.searchParams.get('sort') || 'rank';
    const { from, to } = parsePaging(url);

    let query = supabase
        .from('quizzes')
        .select('id, slug, title, description, thumbnail_url, has_thumbnail_data, play_count, rank, correct_rate, incorrect_rate, game_count, creator_id, quiz_questions(count)')
        .eq('status', 'published')
        .range(from, to);

    if (sort === 'rank') {
        query = query.order('play_count', { ascending: false });
    } else if (sort === 'latest') {
        query = query.order('created_at', { ascending: false });
    } else if (sort === 'correct_asc') {
        query = query.order('correct_rate', { ascending: true });
    } else if (sort === 'correct_desc') {
        query = query.order('correct_rate', { ascending: false });
    } else {
        query = query.order('play_count', { ascending: false });
    }

    // 정렬 동점일 때 페이지 사이에서 행이 중복/누락되지 않도록 id를 마지막 정렬 키로 둔다
    query = query.order('id', { ascending: true });

    const { data, error } = await query;
    if (error) return errorResponse(error.message);
    // 문제가 없는 퀴즈는 노출하지 않는다
    const rows = (data || []).filter((row) => childCount(row, 'quiz_questions') >= 1).map((row) => stripKey(row, 'quiz_questions'));
    return jsonResponse(rows.map((row) => withThumbUrl(row, 'quiz', url.origin)));
}

// GET /api/quiz-play?id=UUID_OR_SLUG&limit=N - Fetch random questions for a quiz (published only)
// play_count는 여기서 올리지 않는다 → POST /api/play-start (세션당 하루 1회)
async function handleQuizPlay(url, supabase) {
    const quizId = url.searchParams.get('id');
    const limit = parseInt(url.searchParams.get('limit')) || 5;

    if (!quizId) return errorResponse("Quiz ID is required", 400);

    // Fetch quiz info (Try ID first, then slug)
    // thumbnail_data(base64)는 읽지 않는다 — 필요하면 /api/thumb 로 따로 받는다
    let quizQuery = supabase.from('quizzes').select('id, slug, title, description, thumbnail_url, has_thumbnail_data, play_count, rank, correct_rate, incorrect_rate, game_count, correct_count, incorrect_count, creator_id, created_at, status, source').eq('status', 'published');

    if (quizId.length === 36 && quizId.includes('-')) { // Likely UUID
        quizQuery = quizQuery.eq('id', quizId);
    } else {
        quizQuery = quizQuery.eq('slug', quizId);
    }

    const { data: quizInfo, error: quizError } = await quizQuery.single();

    // 행이 없을 때만 404 — DB 일시 장애를 404로 돌려주면 검색엔진이 정상 페이지를 noindex 처리한다
    if (quizError && quizError.code !== 'PGRST116') return errorResponse('Failed to load quiz', 503);
    if (!quizInfo) return errorResponse("Quiz not found", 404);

    const actualId = quizInfo.id; // Correct UUID for questions lookup

    // Fetch only embeddable questions for this quiz
    const { data: questions, error: questionsError } = await supabase
        .from('quiz_questions')
        .select('id, video_id, start_time, end_time, answer, options, question_text, explanation')
        .eq('quiz_id', actualId)
        .neq('is_embeddable', false);

    if (questionsError) return errorResponse(questionsError.message);

    // Shuffle and limit
    const shuffled = questions.sort(() => 0.5 - Math.random());
    const selectedQuestions = shuffled.slice(0, limit);

    return jsonResponse({ quiz: withThumbUrl(quizInfo, 'quiz', url.origin), questions: selectedQuestions });
}

// POST /api/quiz-result - Save game result and update stats
async function handleQuizResult(request, supabase) {
    try {
        const body = await request.json();
        const { quizId, correctCount, incorrectCount } = body;

        if (!quizId) return errorResponse("quizId is required", 400);

        // Fetch current stats
        const { data: quiz, error: fetchErr } = await supabase
            .from('quizzes')
            .select('correct_count, incorrect_count, game_count')
            .eq('id', quizId)
            .single();

        if (fetchErr) return errorResponse(fetchErr.message);

        // Try RPC first for security definitions
        const { error: rpcErr } = await supabase.rpc('update_quiz_stats', {
            q_id: quizId,
            add_correct: correctCount || 0,
            add_incorrect: incorrectCount || 0
        });

        // Fallback or explicit calculations
        const newCorrect = (quiz.correct_count || 0) + (correctCount || 0);
        const newIncorrect = (quiz.incorrect_count || 0) + (incorrectCount || 0);
        const newGameCount = (quiz.game_count || 0) + 1;
        const total = newCorrect + newIncorrect;
        const correct_rate = total > 0 ? Math.round((newCorrect / total) * 10000) / 100 : 0;
        const incorrect_rate = total > 0 ? Math.round((newIncorrect / total) * 10000) / 100 : 0;

        if (rpcErr) {
            const { error: updateErr } = await supabase
                .from('quizzes')
                .update({
                    correct_count: newCorrect,
                    incorrect_count: newIncorrect,
                    game_count: newGameCount,
                    correct_rate,
                    incorrect_rate
                })
                .eq('id', quizId);

            if (updateErr) return errorResponse(updateErr.message);
        }

        // Recalculate all ranks by play_count
        const { data: allQuizzes } = await supabase
            .from('quizzes')
            .select('id, play_count')
            .order('play_count', { ascending: false });

        if (allQuizzes) {
            for (let i = 0; i < allQuizzes.length; i++) {
                await supabase
                    .from('quizzes')
                    .update({ rank: i + 1 })
                    .eq('id', allQuizzes[i].id);
            }
        }

        return jsonResponse({ success: true, correct_rate, incorrect_rate });
    } catch (err) {
        return errorResponse(err.message || "Internal Server Error");
    }
}

export { handleDailyQuiz, handleQuizPlay, handleQuizResult };
