// quiz.js - Quiz API route handlers

import { jsonResponse, errorResponse } from '../helpers/cors.js';

// GET /api/daily-quiz - Fetch quiz list for main page
async function handleDailyQuiz(supabase) {
    const { data, error } = await supabase
        .from('quizzes')
        .select('id, title, description')
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) return errorResponse(error.message);
    return jsonResponse(data);
}

// GET /api/quiz-play?id=UUID&limit=N - Fetch random questions for a quiz
async function handleQuizPlay(url, supabase) {
    const quizId = url.searchParams.get('id');
    const limit = parseInt(url.searchParams.get('limit')) || 5;

    if (!quizId) return errorResponse("Quiz ID is required", 400);

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

export { handleDailyQuiz, handleQuizPlay };
