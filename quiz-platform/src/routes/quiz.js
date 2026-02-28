// quiz.js - Quiz API route handlers

import { jsonResponse, errorResponse } from '../helpers/cors.js';

// GET /api/daily-quiz?sort=rank|latest|correct_asc|correct_desc
async function handleDailyQuiz(url, supabase) {
    const sort = url.searchParams.get('sort') || 'rank';

    let query = supabase
        .from('quizzes')
        .select('id, title, description, play_count, rank, correct_rate, incorrect_rate, game_count')
        .limit(100);

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

    const { data, error } = await query;
    if (error) return errorResponse(error.message);
    return jsonResponse(data);
}

// GET /api/quiz-play?id=UUID&limit=N - Fetch random questions for a quiz
async function handleQuizPlay(url, supabase) {
    const quizId = url.searchParams.get('id');
    const limit = parseInt(url.searchParams.get('limit')) || 5;

    if (!quizId) return errorResponse("Quiz ID is required", 400);

    // Increment play_count
    await supabase.rpc('increment_play_count', { quiz_id: quizId }).maybeSingle();
    // Fallback: direct update if rpc fails
    const { data: current } = await supabase
        .from('quizzes')
        .select('play_count')
        .eq('id', quizId)
        .single();
    if (current) {
        await supabase
            .from('quizzes')
            .update({ play_count: (current.play_count || 0) + 1 })
            .eq('id', quizId);
    }

    // Fetch quiz info
    const { data: quizInfo, error: quizError } = await supabase
        .from('quizzes')
        .select('*')
        .eq('id', quizId)
        .single();

    if (quizError) return errorResponse(quizError.message);

    // Fetch only embeddable questions for this quiz
    const { data: questions, error: questionsError } = await supabase
        .from('quiz_questions')
        .select('id, video_id, start_time, end_time, answer, options')
        .eq('quiz_id', quizId)
        .neq('is_embeddable', false);

    if (questionsError) return errorResponse(questionsError.message);

    // Shuffle and limit
    const shuffled = questions.sort(() => 0.5 - Math.random());
    const selectedQuestions = shuffled.slice(0, limit);

    return jsonResponse({ quiz: quizInfo, questions: selectedQuestions });
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

        const newCorrect = (quiz.correct_count || 0) + (correctCount || 0);
        const newIncorrect = (quiz.incorrect_count || 0) + (incorrectCount || 0);
        const newGameCount = (quiz.game_count || 0) + 1;
        const total = newCorrect + newIncorrect;
        const correct_rate = total > 0 ? Math.round((newCorrect / total) * 10000) / 100 : 0;
        const incorrect_rate = total > 0 ? Math.round((newIncorrect / total) * 10000) / 100 : 0;

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

