const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envContent = fs.readFileSync('.dev.vars', 'utf-8');
const supabaseUrl = envContent.match(/SUPABASE_URL="(.*?)"/)[1];
const supabaseKey = envContent.match(/SUPABASE_ANON_KEY="(.*?)"/)[1];
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log("Adding thumbnail_url columns...");

    // We can't run raw SQL easily via JS client unless we have a special RPC.
    // However, for thumbnails, we can check if they exist or just use them if it doesn't fail.
    // In many cases, adding a column to a Supabase table requires the SQL editor or a service-role key.

    // I will try a simple update to see if the column exists.
    const { error: testError } = await supabase
        .from('quizzes')
        .select('thumbnail_url')
        .limit(1);

    if (testError && testError.message.includes('column "thumbnail_url" does not exist')) {
        console.log("Column 'thumbnail_url' does not exist. Please add it via Supabase SQL Editor:");
        console.log("ALTER TABLE quizzes ADD COLUMN thumbnail_url TEXT;");
        console.log("ALTER TABLE worldcups ADD COLUMN thumbnail_url TEXT;");
    } else {
        console.log("Column 'thumbnail_url' already exists or other error:", testError ? testError.message : "Success");
    }
}

run();
