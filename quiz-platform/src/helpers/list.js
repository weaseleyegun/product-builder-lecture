// list.js - 목록 API 공용 유틸 (페이징, base64 썸네일 치환)

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ?limit=&offset= 파싱. 잘못된 값은 기본값으로, limit은 max로 제한한다.
export function parsePaging(url, defaultLimit = 60, maxLimit = 100) {
    const rawLimit = parseInt(url.searchParams.get('limit'), 10);
    const rawOffset = parseInt(url.searchParams.get('offset'), 10);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, maxLimit) : defaultLimit;
    const offset = Number.isFinite(rawOffset) && rawOffset > 0 ? rawOffset : 0;
    return { limit, offset, from: offset, to: offset + limit - 1 };
}

// DB에 base64(data:)로 저장된 썸네일은 응답을 수 MB로 키우므로 별도 캐시 가능한 URL로 바꾼다.
export function withThumbUrl(row, kind, origin) {
    if (row && typeof row.thumbnail_url === 'string' && row.thumbnail_url.startsWith('data:')) {
        return { ...row, thumbnail_url: `${origin}/api/thumb/${kind}/${row.id}` };
    }
    return row;
}
