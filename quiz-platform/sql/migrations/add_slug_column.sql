-- Migration: Add slug columns to quizzes and worldcups tables
-- Run this in Supabase SQL Editor

-- 1. Add slug column to quizzes
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS slug TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS quizzes_slug_idx ON quizzes(slug) WHERE slug IS NOT NULL;

-- 2. Add slug column to worldcups
ALTER TABLE worldcups ADD COLUMN IF NOT EXISTS slug TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS worldcups_slug_idx ON worldcups(slug) WHERE slug IS NOT NULL;

-- 3. Auto-generate slug for existing quizzes (quiz- + first 8 chars of UUID)
UPDATE quizzes
SET slug = 'quiz-' || SUBSTRING(id::text, 1, 8)
WHERE slug IS NULL;

-- 4. Auto-generate slug for existing worldcups
-- Tier lists get 'tier-' prefix, regular worldcups get 'wc-' prefix
UPDATE worldcups
SET slug = CASE
    WHEN title ILIKE '%티어%' OR title ILIKE '%등급%' OR title ILIKE '%랭킹%' OR title ILIKE '%리스트%'
    THEN 'tier-' || SUBSTRING(id::text, 1, 8)
    ELSE 'wc-' || SUBSTRING(id::text, 1, 8)
END
WHERE slug IS NULL;

-- Verify results
SELECT 'quizzes' as table_name, COUNT(*) as total, COUNT(slug) as with_slug FROM quizzes
UNION ALL
SELECT 'worldcups', COUNT(*), COUNT(slug) FROM worldcups;
