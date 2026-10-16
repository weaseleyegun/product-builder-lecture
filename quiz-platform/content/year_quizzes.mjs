// content/year_quizzes.mjs - "발매 연도 맞추기" 영상 퀴즈 (영상은 가리지 않고 그대로 재생한다)
//
// - 영상 플레이어에는 곡 제목이 표시되므로, 정답이 제목이 아닌 '발매 연도'인 문제만 만든다.
// - 영상 ID/구간은 이미 공개 중인 퀴즈에서 쓰던 값을 그대로 쓴다. 연도는 직접 확인한 공식 발매 연도다.
//   (애매한 곡 — 앨범과 싱글 연도가 다른 곡 등 — 은 넣지 않았다.)
// - 공개는 자동으로 하지 않는다: scripts/submit_drafts.mjs 가 초안으로 제출하고, 대시보드에서 사람이 검수한다.

// [영상ID, 시작, 끝, 곡 표시명, 발매연도]
const POP = [
    ['fJ9rUzIMcZQ', 153, 158, 'Queen - Bohemian Rhapsody', 1975],
    ['3JWTaaS7LdU', 107, 112, 'Whitney Houston - I Will Always Love You', 1992],
    ['yKNxeF4KMsY', 130, 135, 'Coldplay - Yellow', 2000],
    ['k4V3Mo61fJM', 139, 144, 'Coldplay - Fix You', 2005],
    ['CvBfHwUxHIk', 81, 86, 'Rihanna - Umbrella', 2007],
    ['dvgZkm1xWPE', 117, 122, 'Coldplay - Viva la Vida', 2008],
    ['8xg3vE8Ie_E', 73, 78, 'Taylor Swift - Love Story', 2008],
    ['qrO4YZeyl0I', 146, 151, 'Lady Gaga - Bad Romance', 2009],
    ['kffacxfA7G4', 77, 82, 'Justin Bieber - Baby', 2010],
    ['QGJuMBdaqIw', 108, 113, 'Katy Perry - Firework', 2010],
    ['hLQl3WQQoQ0', 140, 145, 'Adele - Someone Like You', 2011],
    ['tg00YEETFzg', 135, 140, 'Rihanna - We Found Love', 2011],
    ['ktvTqknDobU', 100, 105, 'Imagine Dragons - Radioactive', 2012],
    ['CevxZvSJLk8', 104, 109, 'Katy Perry - Roar', 2013],
    ['ZbZSe6N_BXs', 108, 113, 'Pharrell Williams - Happy', 2013],
    ['OPf0YbXqDm0', 99, 104, 'Bruno Mars - Uptown Funk', 2014],
    ['nfWlot6h_JM', 88, 93, 'Taylor Swift - Shake It Off', 2014],
    ['e-ORhEE9VVg', 83, 88, 'Taylor Swift - Blank Space', 2014],
    ['YQHsXMglC9A', 126, 131, 'Adele - Hello', 2015],
    ['RgKAFK5djSk', 117, 122, 'Charlie Puth - See You Again', 2015],
    ['34Na4j8AVgA', 117, 122, 'The Weeknd - Starboy', 2016],
    ['JGwWNGJdvx8', 128, 133, 'Ed Sheeran - Shape of You', 2017],
    ['7wtfhZwyrcc', 88, 93, 'Imagine Dragons - Believer', 2017],
    ['DyDfgMOUjCI', 98, 103, 'Billie Eilish - bad guy', 2019],
    ['6swmTBVI83k', 88, 93, 'Lil Nas X - MONTERO', 2021],
    ['ZmDBbnmKpqQ', 97, 102, 'Olivia Rodrigo - drivers license', 2021],
    ['G7KNmW9a75Y', 66, 71, 'Miley Cyrus - Flowers', 2023],
    ['6wBaW_OoRHk', 40, 45, 'Sabrina Carpenter - Espresso', 2024],
];

const KPOP = [
    ['U7mPqycQ0tQ', 86, 91, '소녀시대 - Gee', 2009],
    ['x6QA3m58DQw', 126, 131, 'Super Junior - Sorry, Sorry', 2009],
    ['BA7fdSkp8ds', 172, 177, '원더걸스 - Nobody', 2008],
    ['cRdvzzWIfkA', 89, 94, 'IU - 좋은 날', 2010],
    ['j7_lSP8Vc3o', 90, 95, '2NE1 - 내가 제일 잘 나가', 2011],
    ['AAbokV76tkU', 78, 83, 'BIGBANG - FANTASTIC BABY', 2012],
    ['9bZkp7q19f0', 99, 104, 'PSY - 강남스타일', 2012],
    ['I3dezFzsNss', 95, 100, 'EXO - 으르렁 (Growl)', 2013],
    ['ASO_zypdnsQ', 75, 80, 'PSY - GENTLEMAN', 2013],
    ['2ips2mM7Zqw', 97, 102, 'BIGBANG - 뱅뱅뱅', 2015],
    ['ePpPVE-GGJw', 114, 119, 'TWICE - TT', 2016],
    ['hmE9f-TEutc', 161, 166, 'BTS - 피 땀 눈물', 2016],
    ['xEeFrLSkMm8', 153, 158, 'BTS - 봄날 (Spring Day)', 2017],
    ['MBdVXkSdhwU', 104, 109, 'BTS - DNA', 2017],
    ['IHNzOHi8sJs', 85, 90, 'BLACKPINK - 뚜두뚜두', 2018],
    ['pBuZEGYXA6E', 83, 88, 'BTS - IDOL', 2018],
    ['gdZLi9oWNZg', 68, 73, 'BTS - Dynamite', 2020],
    ['WMweEpGlu_U', 57, 62, 'BTS - Butter', 2021],
    ['pSUydWEqKwE', 129, 134, 'NewJeans - Ditto', 2022],
    ['Jn8KvdWagfo', 62, 67, '로제 - APT.', 2024],
];

// 정답 연도 주변의 그럴듯한 보기 3개를 결정적으로 만든다.
// 정답보다 이른 보기를 문제마다 0~3개로 돌려 가며 넣어, 정답 위치(A~D)가 고르게 분산된다.
function yearOptions(answer, i) {
    const MAX = 2025, MIN = 1950;
    const rot = (arr, n) => arr.map((_, k) => arr[(k + n) % arr.length]);
    const lowerPool = rot([2, 1, 4, 3, 6, 5], i), upperPool = rot([1, 3, 2, 4, 5, 6], i);
    let below = i % 4;
    const picked = new Set();
    const addBelow = () => { for (const d of lowerPool) if (answer - d >= MIN && !picked.has(answer - d)) { picked.add(answer - d); return true; } return false; };
    const addAbove = () => { for (const d of upperPool) if (answer + d <= MAX && !picked.has(answer + d)) { picked.add(answer + d); return true; } return false; };
    for (let k = 0; k < below; k++) addBelow();
    while (picked.size < 3) { if (!addAbove() && !addBelow()) break; }
    const sorted = [...picked, answer].sort((x, y) => x - y);
    return sorted.map((y, k) => ({ id: 'ABCD'[k], text: String(y), isCorrect: y === answer }));
}

function build({ title, description, list }) {
    return {
        kind: 'quiz',
        source: 'curated',
        draft: {
            title,
            description,
            questions: list.map(([videoId, startTime, endTime, name, year], i) => ({
                videoId, startTime, endTime,
                questionText: '이 곡이 발매된 해는 언제일까요?',
                answer: String(year),
                options: yearOptions(year, i),
                explanation: `${name}은(는) ${year}년에 발매되었습니다.`,
            })),
        },
    };
}

export const YEAR_QUIZZES = [
    build({
        title: '팝송 발매 연도 맞추기 — 이 노래는 몇 년도 곡?',
        description:
            '익숙한 팝송인데 막상 언제 나온 곡인지는 헷갈릴 때가 많습니다. 이 퀴즈는 1975년 퀸의 보헤미안 랩소디부터 2024년 사브리나 카펜터의 에스프레소까지, 반세기에 걸친 대표 팝송 28곡의 영상 일부를 들려 주고 발매 연도를 맞히는 방식으로 만들었습니다. ' +
            '곡 제목은 영상에 그대로 나오니 제목을 맞히는 게임이 아니라, 노래의 분위기와 소리로 시대를 짐작해 보는 게임입니다. 정답을 고르면 곡의 정확한 발매 연도를 바로 알려 주므로 풀다 보면 시대별 유행의 흐름도 자연스럽게 눈에 들어옵니다. ' +
            '오래된 곡과 최신곡이 섞여 있어 세대가 다른 사람끼리 함께 풀어도 재미있습니다. 몇 개나 맞히는지 가족, 친구와 점수를 비교해 보세요.',
        list: POP,
    }),
    build({
        title: 'K-POP 발매 연도 맞추기 — 그 노래, 몇 년도 곡?',
        description:
            '소녀시대의 지와 원더걸스의 노바디가 나온 2008~2009년부터 2024년 로제의 아파트까지, K-POP 히트곡 20곡의 영상 일부를 보고 발매 연도를 맞히는 퀴즈입니다. ' +
            '아이돌 세대가 바뀌어 온 흐름과 시대별 곡 분위기를 떠올리며 풀 수 있어서 오래 K-POP을 들어 온 사람에게도, 최근에 입문한 사람에게도 재미있습니다. 영상은 가리지 않고 그대로 보여 주며, 정답을 고르면 해당 곡의 정확한 발매 연도를 확인할 수 있습니다. ' +
            '제목이 아닌 연도를 묻기 때문에 제목을 알고 있어도 시대 감각이 필요하고, 모르는 곡이 나와도 곡의 분위기와 영상 스타일로 짐작해 볼 수 있습니다. 같이 보던 시절의 추억을 떠올리며 도전해 보세요.',
        list: KPOP,
    }),
];
