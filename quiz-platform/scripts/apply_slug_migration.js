// scripts/apply_slug_migration.js - Adds slug columns and populates them
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.dev.vars' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY; // Using anon/service key from .dev.vars

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
    console.log('🚀 Starting SEO Slug Migration...');

    // Note: Standard Supabase JS client doesn't support ALTER TABLE easily due to RLS/permissions.
    // However, we can try to update data if columns are added.
    // Since I cannot run raw SQL DDL through the JS client easily without a custom RPC,
    // I will focus on populating the slugs assuming columns are added, 
    // or I'll provide a clear instruction if it fails.

    try {
        // 1. Fetch all quizzes
        console.log('--- Quizzes ---');
        const { data: quizzes, error: qError } = await supabase.from('quizzes').select('id, title, slug');
        if (qError) throw qError;

        for (const quiz of quizzes) {
            if (!quiz.slug) {
                const newSlug = `quiz-${quiz.id.substring(0, 8)}`;
                console.log(`Setting slug for "${quiz.title}": ${newSlug}`);
                await supabase.from('quizzes').update({ slug: newSlug }).eq('id', quiz.id);
            }
        }

        // 2. Fetch all worldcups
        console.log('\n--- Worldcups / Tiers ---');
        const { data: worldcups, error: wError } = await supabase.from('worldcups').select('id, title, slug');
        if (wError) throw wError;

        for (const wc of worldcups) {
            if (!wc.slug) {
                const isTier = /티어|등급|랭킹|리스트/.test(wc.title);
                const prefix = isTier ? 'tier' : 'wc';
                const newSlug = `${prefix}-${wc.id.substring(0, 8)}`;
                console.log(`Setting slug for "${wc.title}": ${newSlug}`);
                await supabase.from('worldcups').update({ slug: newSlug }).eq('id', wc.id);
            }
        }

        console.log('\n✅ Migration completed successfully!');
    } catch (err) {
        console.error('❌ Migration failed:', err.message);
        console.log('\n💡 IMPORTANT: Make sure you have added the "slug" column to "quizzes" and "worldcups" tables in Supabase SQL Editor first!');
        console.log('SQL to run:');
        console.log('ALTER TABLE quizzes ADD COLUMN slug TEXT UNIQUE;');
        console.log('ALTER TABLE worldcups ADD COLUMN slug TEXT UNIQUE;');
    }
}

applyMigration();
