// config.js - Central configuration for API URLs and constants

const API_BASE_URL = 'https://quiz-platform-worker.rlaehrjs03.workers.dev';
const LOCAL_API_URL = 'http://localhost:8787';

// Quiz card metadata: keyword matching, gradient color, tag, and thumbnail image
const QUIZ_META = [
    { keyword: 'J-POP', gradient: 'linear-gradient(135deg, #FF6B6B, #FF8E53)', tag: 'J-POP', thumbnail: 'images/thumbnails/jpop.png' },
    { keyword: 'K-POP', gradient: 'linear-gradient(135deg, #AE3EC9, #7048E8)', tag: 'K-POP', thumbnail: 'images/thumbnails/kpop.png' },
    { keyword: '빌보드', gradient: 'linear-gradient(135deg, #F59F00, #FCC419)', tag: '팝송', thumbnail: 'images/thumbnails/billboard.png' },
    { keyword: '팝송', gradient: 'linear-gradient(135deg, #F59F00, #FCC419)', tag: '팝송', thumbnail: 'images/thumbnails/billboard.png' },
    { keyword: '애니', gradient: 'linear-gradient(135deg, #0CA678, #38D9A9)', tag: '애니', thumbnail: 'images/thumbnails/anime.png' },
    { keyword: 'OST', gradient: 'linear-gradient(135deg, #0CA678, #38D9A9)', tag: '애니', thumbnail: 'images/thumbnails/anime.png' },
    { keyword: '브금', gradient: 'linear-gradient(135deg, #5C7CFA, #748FFC)', tag: '게임', thumbnail: 'images/thumbnails/game.png' },
    { keyword: 'BGM', gradient: 'linear-gradient(135deg, #5C7CFA, #748FFC)', tag: '게임', thumbnail: 'images/thumbnails/game.png' },
    { keyword: '게임', gradient: 'linear-gradient(135deg, #5C7CFA, #748FFC)', tag: '게임', thumbnail: 'images/thumbnails/game.png' },
];

// Worldcup card metadata: keyword matching with thumbnails
var WORLDCUP_META = [
    { keyword: '음식', gradient: 'linear-gradient(135deg, #F59F00, #FCC419)', thumbnail: 'images/thumbnails/wc_food.png' },
    { keyword: '카페', gradient: 'linear-gradient(135deg, #F59F00, #FCC419)', thumbnail: 'images/thumbnails/wc_cafe.png' },
    { keyword: '음료', gradient: 'linear-gradient(135deg, #F59F00, #FCC419)', thumbnail: 'images/thumbnails/wc_cafe.png' },
    { keyword: '강아지', gradient: 'linear-gradient(135deg, #20C997, #69DB7C)', thumbnail: 'images/thumbnails/wc_dog.png' },
    { keyword: '게임', gradient: 'linear-gradient(135deg, #5C7CFA, #748FFC)', thumbnail: 'images/thumbnails/wc_game.png' }, // Put this before '캐릭터' so Game Character matches this first
    { keyword: '애니', gradient: 'linear-gradient(135deg, #AE3EC9, #F06595)', thumbnail: 'images/thumbnails/wc_anime.png' },
    { keyword: '캐릭터', gradient: 'linear-gradient(135deg, #AE3EC9, #F06595)', thumbnail: 'images/thumbnails/wc_anime.png' },
];

// Worldcup card gradient colors (fallback)
var WORLDCUP_COLORS = [
    'linear-gradient(135deg, #F59F00, #FCC419)',
    'linear-gradient(135deg, #20C997, #69DB7C)',
    'linear-gradient(135deg, #AE3EC9, #F06595)',
    'linear-gradient(135deg, #5C7CFA, #748FFC)'
];
