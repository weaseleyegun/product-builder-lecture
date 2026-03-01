const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const e = fs.readFileSync('.dev.vars', 'utf-8');
const s = createClient(e.match(/SUPABASE_URL="(.*?)"/)[1], e.match(/SUPABASE_ANON_KEY="(.*?)"/)[1]);

async function fix() {
    console.log("Fetching all quiz_questions...");
    const { data: qData, error } = await s.from('quiz_questions').select('id, options, quiz_id');
    if (error) return console.error(error);

    let toDelete = [];

    qData.forEach(q => {
        if (!q.options) return;
        let opts = typeof q.options === 'string' ? JSON.parse(q.options) : q.options;
        // Check if any option length < 3 (like 'A', 'B', 'Ad') EXCEPT valid short names like '리신', '타짜'
        let weirdText = opts.some(o => {
            let t = o.text.trim();
            // English A, B, C, D, Ad etc.
            if (/^[A-Za-z]{1,2}$/.test(t)) return true;
            return false;
        });

        if (weirdText) {
            toDelete.push(q.id);
            console.log("Buggy Options found on id:", q.id, "Options:", opts.map(o => o.text));
        }
    });

    console.log(`Found ${toDelete.length} corrupted questions.`);
    if (toDelete.length > 0) {
        // Delete them
        const { error: delErr } = await s.from('quiz_questions').delete().in('id', toDelete);
        if (delErr) {
            console.error("Delete failed", delErr);
        } else {
            console.log("Successfully deleted corrupted questions.");
        }
    }
}
fix();
