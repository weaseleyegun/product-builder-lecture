// list.js - 목록 API 공용 유틸 (페이징, base64 썸네일 치환, 빈 콘텐츠 판별)

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// 관리자 편집 화면이 받아 간 썸네일 URL(우리 서버 /api/thumb/...)을 되돌려 보낼 때 식별용
export const THUMB_URL_RE = /\/api\/thumb\/(quiz|worldcup)\/[0-9a-f-]{36}/i;

// ?limit=&offset= 파싱. 잘못된 값은 기본값으로, limit은 max로 제한한다.
export function parsePaging(url, defaultLimit = 100, maxLimit = 100) {
    const rawLimit = parseInt(url.searchParams.get('limit'), 10);
    const rawOffset = parseInt(url.searchParams.get('offset'), 10);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, maxLimit) : defaultLimit;
    const offset = Number.isFinite(rawOffset) && rawOffset > 0 ? rawOffset : 0;
    return { limit, offset, from: offset, to: offset + limit - 1 };
}

// base64 썸네일은 DB의 thumbnail_data 컬럼에 있고, 목록에는 has_thumbnail_data(boolean)만 읽는다.
// 이 경우(그리고 예전 방식으로 thumbnail_url에 data:가 남아 있는 경우) 캐시 가능한 /api/thumb URL로 바꾼다.
// 응답에서 내부용 필드(has_thumbnail_data)는 제거한다.
export function withThumbUrl(row, kind, origin) {
    if (!row) return row;
    const { has_thumbnail_data, ...rest } = row;
    const legacyData = typeof rest.thumbnail_url === 'string' && rest.thumbnail_url.startsWith('data:');
    if (legacyData || (!rest.thumbnail_url && has_thumbnail_data)) {
        return { ...rest, thumbnail_url: `${origin}/api/thumb/${kind}/${rest.id}` };
    }
    return rest;
}

// 임베디드 카운트 select(`child(count)`)로 받은 자식 수. 없으면 0.
export function childCount(row, childKey) {
    const arr = row && row[childKey];
    return Array.isArray(arr) && arr[0] && typeof arr[0].count === 'number' ? arr[0].count : 0;
}

// 내부용 임베드 필드를 응답에서 제거
export function stripKey(row, key) {
    const { [key]: _drop, ...rest } = row;
    return rest;
}
