import { GoogleGenerativeAI } from '@google/generative-ai';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const key = process.env.GEMINI_API_KEY;
console.log("Key found:", key ? "Yes (starts with " + key.substring(0, 5) + ")" : "No");

const genAI = new GoogleGenerativeAI(key);
const model = genAI.getGenerativeModel({ model: "gemini-pro" });

async function test() {
    try {
        const result = await model.generateContent("Hello, are you working?");
        console.log("Response:", result.response.text());
    } catch (e) {
        console.error("Error:", e);
    }
}

test();
