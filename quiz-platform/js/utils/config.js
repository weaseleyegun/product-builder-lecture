// config.js - Central configuration for API URLs and constants

const API_BASE_URL = 'https://quiz-platform-worker.rlaehrjs03.workers.dev';
const LOCAL_API_URL = 'http://localhost:8787';

// Quiz card metadata: keyword matching, gradient color, tag, and thumbnail image
const QUIZ_META = [
    { keyword: 'J-POP', gradient: 'linear-gradient(135deg, #FF6B6B, #FF8E53)', tag: 'J-POP', thumbnail: 'images/thumbnails/jpop.png', hashtags: ['일본', '일본노래', '노래', 'j-pop', '제이팝'] },
    { keyword: 'K-POP', gradient: 'linear-gradient(135deg, #AE3EC9, #7048E8)', tag: 'K-POP', thumbnail: 'images/thumbnails/kpop.png', hashtags: ['한국', '한국노래', '노래', '케이팝', 'k-pop'] },
    { keyword: '빌보드', gradient: 'linear-gradient(135deg, #F59F00, #FCC419)', tag: '팝송', thumbnail: 'images/thumbnails/billboard.png', hashtags: ['팝송', '외국노래', '미국노래', '노래', '빌보드'] },
    { keyword: '팝송', gradient: 'linear-gradient(135deg, #F59F00, #FCC419)', tag: '팝송', thumbnail: 'images/thumbnails/billboard.png', hashtags: ['팝송', '외국노래', '노래', '빌보드'] },
    { keyword: '애니', gradient: 'linear-gradient(135deg, #0CA678, #38D9A9)', tag: '애니', thumbnail: 'images/thumbnails/anime.png', hashtags: ['애니', '애니메이션', '만화', '노래', 'ost'] },
    { keyword: 'OST', gradient: 'linear-gradient(135deg, #0CA678, #38D9A9)', tag: '애니', thumbnail: 'images/thumbnails/anime.png', hashtags: ['애니', '애니메이션', '만화', '노래', 'ost'] },
    { keyword: '브금', gradient: 'linear-gradient(135deg, #5C7CFA, #748FFC)', tag: '게임', thumbnail: 'images/thumbnails/game.png', hashtags: ['게임', '브금', 'bgm', '배경음악'] },
    { keyword: 'BGM', gradient: 'linear-gradient(135deg, #5C7CFA, #748FFC)', tag: '게임', thumbnail: 'images/thumbnails/game.png', hashtags: ['게임', '브금', 'bgm', '배경음악'] },
    { keyword: '게임', gradient: 'linear-gradient(135deg, #5C7CFA, #748FFC)', tag: '게임', thumbnail: 'images/thumbnails/game.png', hashtags: ['게임', '브금', 'bgm', '배경음악'] },
    { keyword: '우타이테', gradient: 'linear-gradient(135deg, #FF007F, #7000FF)', tag: '우타이테', thumbnail: 'images/thumbnails/utaite.png', hashtags: ['얼굴없는가수', '우타이테', '유튜브가수', '일본가수', '일본노래', 'j-pop'] }
];

// Worldcup card metadata: keyword matching with thumbnails
var WORLDCUP_META = [
    { keyword: '음식', gradient: 'linear-gradient(135deg, #F59F00, #FCC419)', thumbnail: 'images/thumbnails/wc_food.png', hashtags: ['음식', '먹방', '푸드'] },
    { keyword: '카페', gradient: 'linear-gradient(135deg, #F59F00, #FCC419)', thumbnail: 'images/thumbnails/wc_cafe.png', hashtags: ['카페', '디저트', '음료'] },
    { keyword: '음료', gradient: 'linear-gradient(135deg, #F59F00, #FCC419)', thumbnail: 'images/thumbnails/wc_cafe.png', hashtags: ['카페', '디저트', '음료'] },
    { keyword: '강아지', gradient: 'linear-gradient(135deg, #20C997, #69DB7C)', thumbnail: 'images/thumbnails/wc_dog.png', hashtags: ['강아지', '동물', '반려견', '개'] },
    { keyword: '게임', gradient: 'linear-gradient(135deg, #5C7CFA, #748FFC)', thumbnail: 'images/thumbnails/wc_game.png', hashtags: ['게임', '비디오게임', 'pc게임'] },
    { keyword: '애니', gradient: 'linear-gradient(135deg, #AE3EC9, #F06595)', thumbnail: 'images/thumbnails/wc_anime.png', hashtags: ['애니', '애니메이션', '캐릭터', '만화'] },
    { keyword: '캐릭터', gradient: 'linear-gradient(135deg, #AE3EC9, #F06595)', thumbnail: 'images/thumbnails/wc_anime.png', hashtags: ['애니', '애니메이션', '캐릭터', '만화'] },
];

// Worldcup card gradient colors (fallback)
var WORLDCUP_COLORS = [
    'linear-gradient(135deg, #F59F00, #FCC419)',
    'linear-gradient(135deg, #20C997, #69DB7C)',
    'linear-gradient(135deg, #AE3EC9, #F06595)',
    'linear-gradient(135deg, #5C7CFA, #748FFC)'
];
