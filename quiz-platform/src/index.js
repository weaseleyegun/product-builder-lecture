// index.js - Main Cloudflare Worker entry point (Router)

import { createClient } from '@supabase/supabase-js';
import { handleOptions, jsonResponse, errorResponse, corsHeaders } from './helpers/cors.js';
import { handleDailyQuiz, handleQuizPlay, handleQuizResult, handleUserCreatedQuiz } from './routes/quiz.js';
import { handleWorldcups, handleWorldcupPlay, handleUserCreatedContent } from './routes/worldcup.js';

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        // Handle CORS preflight
        if (request.method === "OPTIONS") {
            return handleOptions();
        }

        // Validate environment variables
        if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
            return errorResponse("Supabase credentials are not configured.");
        }

        // Initialize Supabase client
        const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);

        // Route matching
        const path = url.pathname;
        const method = request.method;

        if (path === '/api/config' && method === 'GET') {
            return jsonResponse({
                SUPABASE_URL: env.SUPABASE_URL,
                SUPABASE_ANON_KEY: env.SUPABASE_ANON_KEY
            });
        }
        if (path === '/api/daily-quiz' && method === 'GET') {
            return handleDailyQuiz(url, supabase);
        }
        if (path === '/api/quiz-play' && method === 'GET') {
            return handleQuizPlay(url, supabase);
        }
        if (path === '/api/worldcups' && method === 'GET') {
            return handleWorldcups(supabase);
        }
        if (path === '/api/worldcup-play' && method === 'GET') {
            return handleWorldcupPlay(url, supabase);
        }
        if (path === '/api/user-created-content' && method === 'POST') {
            return handleUserCreatedContent(request, supabase);
        }
        if (path === '/api/user-created-quiz' && method === 'POST') {
            return handleUserCreatedQuiz(request, supabase);
        }
        if (path === '/api/quiz-result' && method === 'POST') {
            return handleQuizResult(request, supabase);
        }

        // Root health check
        if (path === '/') {
            return new Response("Quiz Platform API is running! Access /api/daily-quiz for data.", {
                status: 200,
                headers: corsHeaders
            });
        }

        // 404 for unmatched routes
        return errorResponse("Not Found: " + path, 404);
    }
};
