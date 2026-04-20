import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

async function list() {
    const key = process.env.GEMINI_API_KEY;
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?key=' + key);
    const d = await r.json();
    if (d.models) {
        console.log(d.models
            .filter(m => m.supportedGenerationMethods.includes('generateContent'))
            .map(m => m.name));
    } else {
        console.log("Error:", d);
    }
}

list();
