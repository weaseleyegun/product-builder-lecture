const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Parse .dev.vars
const vars = {};
fs.readFileSync('.dev.vars', 'utf8').trim().split(/\r?\n/).forEach(line => {
    const idx = line.indexOf('=');
    if (idx > 0) {
        const k = line.slice(0, idx).trim();
        const v = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
        vars[k] = v;
    }
});

const SUPABASE_URL = vars.SUPABASE_URL;
const SUPABASE_ANON_KEY = vars.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY in .dev.vars');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const samples = [
    {
        title: '2026년 1분기 애니 등급 티어',
        description: '2026년 1분기 방영 애니메이션 작품들의 등급을 매겨보세요!',
        items: [{ name: '귀멸의 칼날', image_url: 'https://placehold.co/100x100?text=KNY' }, { name: '주술회전', image_url: 'https://placehold.co/100x100?text=JJK' }]
    },
    {
        title: '역대 최고의 게임 등급 티어',
        description: '역대 레전드 게임들을 S~D 티어로 분류해보세요!',
        items: [{ name: '엘든 링', image_url: 'https://placehold.co/100x100?text=ER' }, { name: '더 위처 3', image_url: 'https://placehold.co/100x100?text=W3' }]
    },
    {
        title: 'K-POP 아이돌 등급 티어 리스트',
        description: '현재 활동 중인 K-POP 아이돌 그룹 랭킹!',
        items: [{ name: 'BTS', image_url: 'https://placehold.co/100x100?text=BTS' }, { name: 'BLACKPINK', image_url: 'https://placehold.co/100x100?text=BP' }]
    },
    {
        title: '인기 만화 등급 리스트',
        description: '역대 인기 만화 작품들의 등급을 매겨보세요.',
        items: [{ name: '원피스', image_url: 'https://placehold.co/100x100?text=OP' }, { name: '나루토', image_url: 'https://placehold.co/100x100?text=NT' }]
    },
    {
        title: '인기 영화 등급 랭킹 티어',
        description: '역대 명작 영화들을 등급별로 분류!',
        items: [{ name: '인터스텔라', image_url: 'https://placehold.co/100x100?text=IS' }, { name: '어벤져스', image_url: 'https://placehold.co/100x100?text=AV' }]
    }
];

async function run() {
    // Sign in as agent to bypass RLS
    const { error: authError } = await supabase.auth.signInWithPassword({
        email: 'agent@quizrank.com',
        password: 'seed_password_1234!'
    });
    if (authError) {
        console.error('Auth failed:', authError.message);
        process.exit(1);
    }
    console.log('Auth OK');

    for (const s of samples) {
        // Insert worldcup row
        const { data: cup, error: cupErr } = await supabase
            .from('worldcups')
            .insert([{ title: s.title, description: s.description }])
            .select();
        if (cupErr) { console.error('Insert worldcup failed:', s.title, cupErr.message); continue; }

        const worldcupId = cup[0].id;

        // Insert items
        const toInsert = s.items.map(item => ({
            worldcup_id: worldcupId,
            name: item.name,
            image_url: item.image_url
        }));
        const { error: itemErr } = await supabase.from('worldcup_items').insert(toInsert);
        if (itemErr) { console.error('Insert items failed:', s.title, itemErr.message); }
        else { console.log('Created:', s.title, '(id:', worldcupId, ')'); }
    }

    console.log('\nDone!');
}

run();
