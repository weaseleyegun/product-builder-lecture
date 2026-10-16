// daily.js - GET /api/daily-pick : 오늘의 퀴즈 (KST 날짜 기준으로 모두에게 같은 퀴즈)
//
// 영상 없이 질문 문장과 해설이 있는 텍스트 퀴즈 중에서 하루에 하나를 고른다. 날짜가 바뀔 때마다 순서대로 돌아가며,
// 후보를 id 순으로 고정해 두므로 같은 날에는 누가, 언제 불러도 같은 결과가 나온다.

import { jsonResponse, errorResponse } from '../helpers/cors.js';

const DAY_MS = 86400000;
const KST_MS = 9 * 3600000;

// KST 기준 날짜 문자열 (YYYY-MM-DD)과 에포크 이후 일수
export function kstDay(now = new Date()) {
    const shifted = new Date(now.getTime() + KST_MS);
    return { date: shifted.toISOString().slice(0, 10), index: Math.floor(shifted.getTime() / DAY_MS) };
}

// quizzes: [{ id, slug, title }] → 오늘의 퀴즈 하나 (후보가 없으면 null)
export function pickDaily(quizzes, dayIndex) {
    const list = [...(quizzes || [])].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return list.length ? list[((dayIndex % list.length) + list.length) % list.length] : null;
}

export async function handleDailyPick(supabase, now = new Date()) {
    // 후보 조회는 DB 함수가 한다 (공개 + 영상 없는 텍스트 문제 보유, id 순). 행 수 제한/URL 길이 문제가 없다.
    const { data: quizzes, error } = await supabase.rpc('daily_candidates');
    if (error) return errorResponse(error.message, 500);

    const { date, index } = kstDay(now);
    const pick = pickDaily(quizzes, index);
    if (!pick) return errorResponse('no daily quiz available', 404);

    const res = jsonResponse({ date, id: pick.id, slug: pick.slug || null, title: pick.title });
    res.headers.set('Cache-Control', 'public, max-age=300');
    return res;
}
