// constants.js - 콘텐츠 품질 검증에 쓰는 목록 (단일 출처)
// GAS 생성기(scripts/gas/quizrank_agent.js)가 실제 운영에서 겪은 사례를 옮겨 둔 것이다. 새로 발견한 것은 여기에 추가한다.

// ── 텍스트 정규화 ──────────────────────────────────────────
// canon: NFKC로 합쳐(자모 분해·전각 문자 등을 통일) 제로폭 문자를 제거한다. 금지어 검사 전에 반드시 거친다.
export const canon = (s) => String(s ?? '').normalize('NFKC').replace(new RegExp('[\\u200b-\\u200f\\u2028-\\u202f\\u2060\\ufeff]', 'g'), '');
// normalizeText: 비교용. 글자(모든 언어)와 숫자만 남기고 소문자로. (일본어·중국어 이름도 비지 않는다)
export const normalizeText = (s) => canon(s).toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

// 비극·정치·금융·범죄성 표현: 가벼운 퀴즈/월드컵의 제목·정답에 어울리지 않고 광고 정책에도 불리하다.
export const BLOCKED_PATTERN = new RegExp([
    '사망|사고|참사|추락|화재|살인|피살|성폭|성범죄|폭행|자살|극단|실종|구속|체포|기소|재판|판결|탄핵',
    '대통령|국회|여당|야당|의원|총선|대선|전쟁|테러|확진|지진|폭발|붕괴|마약|도박|불법|별세|부고|추모|속보',
    '주가|증시|코스피|코스닥|환율|금리|비트코인|코인|공모주|배당|소송|특허|법원|검찰|경찰|특검',
    '사령관|미사일|북한|군사|선로|열차|철도',
].join('|'));
// canon() 후 검사하는 편의 함수
export const isBlocked = (s) => BLOCKED_PATTERN.test(canon(s));

// 영상/이미지만 보고 맞출 수 없는 일반 명사. 정답·후보 이름으로 쓸 수 없다. (normalizeText 형태로 비교)
const GENERIC_LIST = [
    '축구', '야구', '농구', '배구', '테니스', '골프', '탁구', '배드민턴', '수영', '격투기', '복싱', 'ufc', '스포츠',
    '재미', '웃음', '감동', '일상', '브이로그', 'vlog', '리뷰', '추천', '꿀팁', '정보', '뉴스', '속보', '화제', '논란',
    '명장면', '하이라이트', '영상', '연예', '연예인', '배우', '가수', '아이돌', '국대', '한국', '일본', '중국', '미국',
    '외국인', '외국', '해외', '커플', '부부', '가족', '친구', '아기', '동물', '강아지', '고양이', '음식', '여행', '패션',
    '뷰티', '게임', '음악', '노래', '댄스', '챌린지', '편집', '모음', '추억', '감성', '힐링', '웃참', '공감', '팩트',
    '선행', '미담', '기부', '봉사', '응원', '사랑', '우정', '효도', '반전', '실화', '사연', '후기', '비하인드', '현장',
    '직캠', '무대', '공연', '콘서트', '인터뷰', '근황', '레전드', '명대사', '명언', '사이다', '통쾌', '참교육', '복수',
    '응징', '갑질', '역대급', '소름', '충격',
    '넷플릭스', 'netflix', '디즈니', '티빙', '웨이브', '유튜브', 'youtube', 'epl', 'mlb', 'kbo', 'nba', 'lck',
];
export const GENERIC_WORDS = new Set(GENERIC_LIST.map(normalizeText));

// 이미지로 허용하는 호스트. 새 출처를 쓰려면 라이선스/핫링크 허용 여부를 확인한 뒤 추가한다.
export const ALLOWED_IMAGE_HOSTS = [
    'i.ytimg.com', 'upload.wikimedia.org', 'images.unsplash.com', 'images.dog.ceo',
    'cdn.myanimelist.net', 'myanimelist.net',
];

export const LIMITS = {
    title: [8, 60],
    description: [300, 1200],
    questions: [6, 30],
    clipSeconds: [3, 30],
    worldcupSizes: [8, 16, 32, 64],
    textMax: 60,            // 정답·보기·후보 이름 최대 길이
    urlMax: 500,            // 이미지 URL 최대 길이
    duplicateDescriptionSimilarity: 0.6,
};
