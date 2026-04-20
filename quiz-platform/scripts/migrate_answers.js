import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .dev.vars from quiz-platform and .env from root
dotenv.config({ path: path.join(__dirname, '..', '.dev.vars') });
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("Missing Supabase environment variables. Please check SUPABASE_URL, SUPABASE_ANON_KEY.");
    process.exit(1);
}

if (!GEMINI_API_KEY) {
    console.error("⚠️ GEMINI_API_KEY가 설정되어 있지 않습니다.");
    console.log("루트 디렉토리의 .env 파일 혹은 터미널 활성 변수를 확인해주세요.");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function translateText(text) {
    const systemInstruction = "당신은 음악 및 대중문화 전문가입니다. 주어진 텍스트(곡명, 영화 제목 등)를 국내 음원 사이트 및 정식 발매 기준의 '공식 한국어 텍스트' 단 하나로 번역하세요. 만약 원문 자체가 이미 공식 명칭이거나 한국어 발매명이 없다면, 가장 널리 쓰이는 한국어 발음을 기입하세요. 출력은 부가 설명 없이 오직 번역된 텍스트 1줄만 해야 합니다. 예: 'Eve - As You Like It' -> 마음에 드시는 대로";

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            contents: [{
                parts: [{
                    text: `${systemInstruction}\n\n입력: ${text}`
                }]
            }]
        })
    });

    if (!response.ok) {
        const errData = await response.json();
        throw new Error(`Gemini API Error: ${response.status} ${JSON.stringify(errData)}`);
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text.trim();
}

async function migrateAnswers() {
    console.log("Fetching existing quiz questions from Supabase...");
    const { data: questions, error } = await supabase.from('quiz_questions').select('id, answer');

    if (error) {
        console.error("Error fetching data from quiz_questions:", error);
        return;
    }

    if (!questions || questions.length === 0) {
        console.log("No questions found to migrate.");
        return;
    }

    console.log(`Found ${questions.length} quiz items to check.`);

    let updatedCount = 0;

    for (const q of questions) {
        const originalAnswer = q.answer;
        if (!originalAnswer) continue;

        // Simple heuristic: if it contains english or japanese characters, we translate it.
        const regex = /[a-zA-Z\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff66-\uff9f]/;
        if (regex.test(originalAnswer)) {
            console.log(`Checking translation for: "${originalAnswer}"`);
            try {
                const translated = await translateText(originalAnswer);

                if (translated && translated !== originalAnswer) {
                    console.log(`Updating "${originalAnswer}" -> "${translated}"`);

                    const { error: updateError } = await supabase
                        .from('quiz_questions')
                        .update({ answer: translated })
                        .eq('id', q.id);

                    if (updateError) {
                        console.error(`Failed to update ${q.id}:`, updateError);
                    } else {
                        updatedCount++;
                    }
                } else {
                    console.log(`Kept original: "${originalAnswer}"`);
                }

                // Add delay to prevent rate limits (429)
                await new Promise(resolve => setTimeout(resolve, 5000));
            } catch (err) {
                console.error(`Error querying Gemini for "${originalAnswer}":`, err.message);
                // Even on error, wait a bit
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
    }

    console.log(`Migration complete. Updated ${updatedCount} items.`);
}

migrateAnswers();
