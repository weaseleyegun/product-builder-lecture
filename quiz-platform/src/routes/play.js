// play.js - POST /api/play-start : 플레이 시작을 (콘텐츠, 세션, 날짜)당 1회만 집계한다.
// 상세 조회(GET)는 더 이상 play_count를 올리지 않는다. 집계는 DB 함수 register_play가 원자적으로 처리한다.

import { jsonResponse, errorResponse } from '../helpers/cors.js';
import { UUID_RE } from '../helpers/list.js';

async function handlePlayStart(request, supabase) {
    let body;
    try { body = await request.json(); } catch { return errorResponse('Invalid JSON', 400); }

    const { type, id, session } = body || {};
    if (type !== 'quiz' && type !== 'worldcup') return errorResponse('type must be quiz or worldcup', 400);
    if (typeof id !== 'string' || !UUID_RE.test(id)) return errorResponse('id must be a uuid', 400);
    if (typeof session !== 'string' || session.length < 8 || session.length > 64) return errorResponse('invalid session', 400);

    const { data, error } = await supabase.rpc('register_play', { p_type: type, p_id: id, p_session: session });
    if (error) return errorResponse(error.message, 500);
    return jsonResponse({ counted: data === true });
}

export { handlePlayStart };
