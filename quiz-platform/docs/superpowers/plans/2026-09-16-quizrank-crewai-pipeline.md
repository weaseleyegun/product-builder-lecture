# QuizRank CrewAI Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a CrewAI multi-agent pipeline (기획→작성→SEO→검수) that generates quiz and worldcup content for QuizRank, running daily via GitHub Actions in parallel with the existing GAS "No-AI" agent, without touching the live static site.

**Architecture:** A Python package at `scripts/crewai/` with deterministic "tool" functions (YouTube trending/search, Google Trends RSS, JSON validators) separated from LLM-driven CrewAI agents. The LLM never invents a `video_id` or `image_url` — those always come from the deterministic tools. A GitHub Actions workflow runs `main.py` daily, inserting approved content into the same Supabase tables the GAS agent already uses.

**Tech Stack:** Python 3.11+, `crewai`, Gemini (via CrewAI's `LLM` class), `supabase-py`, `requests`, `pytest`.

**Spec:** `docs/superpowers/specs/2026-09-16-quizrank-crewai-pipeline-design.md`

## Global Constraints

- The LLM must never fabricate a YouTube `video_id` or an `image_url` — these only ever come from `tools.py` functions that hit real APIs. (spec: "LLM 환각 방지" constraint)
- Reuse the existing Supabase auth pattern: sign in with `AGENT_EMAIL`/`AGENT_PASSWORD` via the anon key to get a user-scoped token, then insert with that user's id as `creator_id`. Do **not** introduce a new Supabase service-role key. (spec: confirmed against `getSupabaseToken_()` in `scripts/gas/quizrank_agent.js:897-908`)
- DB schema is fixed and already in production — do not alter it. Insert into `quizzes`(title, description, creator_id), `quiz_questions`(quiz_id, video_id, start_time, end_time, answer, options, is_embeddable), `worldcups`(title, description, play_count, creator_id), `worldcup_items`(worldcup_id, name, image_url). (spec: matches `insertQuizToDB_`/`insertWorldcupToDB_`)
- Both quiz and worldcup `description` must be ≥300 characters (carried over AdSense thin-content requirement from `progress.md`).
- `scripts/gas/quizrank_agent.js` and its daily trigger stay untouched — this is a parallel pipeline, not a replacement, until the user decides to cut over.
- Root-level static site files (`index.html`, `quiz-play.html`, `js/`, `images/`, `style.css`, `app.js`, etc.) must not move — Cloudflare Pages serves them directly from repo root.
- 1st-scope content types are `quiz` and `worldcup` only. Tier lists are explicitly out of scope (no DB table exists yet).

---

### Task 0: `scripts/` 폴더 정리

**Files:**
- Move: `scripts/daily_agent.js` → `scripts/agents/daily_agent.js`
- Move: `scripts/crawling_agent.js` → `scripts/agents/crawling_agent.js`
- Move: `scripts/prompt_templates.js` → `scripts/agents/prompt_templates.js`
- Move: `scripts/link_validator.js` → `scripts/agents/link_validator.js`
- Move: `scripts/fix_all_idols.js`, `scripts/fix_all_thumbnails.js`, `scripts/fix_cafe_thumbnails.js`, `scripts/heal_database.js`, `scripts/db_cleanup.js`, `scripts/migrate_answers.js`, `scripts/check_thumbnails.js`, `scripts/verify_youtube.js`, `scripts/remove_theme_switch.js`, `scripts/update_nav_icons.js`, `scripts/server.js` → `scripts/maintenance/`
- Delete: `scripts/temp_check.js`, `scripts/temp_check_columns.js`, `scripts/temp_list_content_models.js`, `scripts/temp_list_models.js`, `scripts/temp_test_gemini.js`

**Interfaces:** None — this is a pure file reorg with no code changes. `crawling_agent.js` imports `./prompt_templates.js` and `./link_validator.js` by relative path (verified: `grep` across `scripts/*.js` found only these two relative imports in the whole directory); moving all three into `scripts/agents/` together keeps those relative paths valid without editing any import line.

- [ ] **Step 1: Move the two agent scripts and their local dependencies together**

```bash
mkdir -p scripts/agents scripts/maintenance
git mv scripts/daily_agent.js scripts/agents/daily_agent.js
git mv scripts/crawling_agent.js scripts/agents/crawling_agent.js
git mv scripts/prompt_templates.js scripts/agents/prompt_templates.js
git mv scripts/link_validator.js scripts/agents/link_validator.js
```

- [ ] **Step 2: Move the maintenance scripts**

```bash
git mv scripts/fix_all_idols.js scripts/maintenance/fix_all_idols.js
git mv scripts/fix_all_thumbnails.js scripts/maintenance/fix_all_thumbnails.js
git mv scripts/fix_cafe_thumbnails.js scripts/maintenance/fix_cafe_thumbnails.js
git mv scripts/heal_database.js scripts/maintenance/heal_database.js
git mv scripts/db_cleanup.js scripts/maintenance/db_cleanup.js
git mv scripts/migrate_answers.js scripts/maintenance/migrate_answers.js
git mv scripts/check_thumbnails.js scripts/maintenance/check_thumbnails.js
git mv scripts/verify_youtube.js scripts/maintenance/verify_youtube.js
git mv scripts/remove_theme_switch.js scripts/maintenance/remove_theme_switch.js
git mv scripts/update_nav_icons.js scripts/maintenance/update_nav_icons.js
git mv scripts/server.js scripts/maintenance/server.js
```

- [ ] **Step 3: Delete the one-off debug scripts**

```bash
git rm scripts/temp_check.js scripts/temp_check_columns.js scripts/temp_list_content_models.js scripts/temp_list_models.js scripts/temp_test_gemini.js
```

- [ ] **Step 4: Verify the moved files still parse and their imports resolve**

Run: `node --check scripts/agents/daily_agent.js && node --check scripts/agents/crawling_agent.js`
Expected: no output, exit code 0 (a syntax/resolve error would print to stderr and exit non-zero)

- [ ] **Step 5: Confirm nothing outside `scripts/` referenced the old paths**

Run: `grep -rn "scripts/daily_agent\|scripts/crawling_agent\|scripts/prompt_templates\|scripts/link_validator\|scripts/fix_\|scripts/heal_database\|scripts/db_cleanup\|scripts/migrate_answers\|scripts/check_thumbnails\|scripts/verify_youtube\|scripts/remove_theme_switch\|scripts/update_nav_icons\|scripts/server\.js\|scripts/temp_" src/ *.html *.js package.json wrangler.toml 2>/dev/null`
Expected: no matches (already confirmed during planning — this step is a final safety re-check before committing)

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: scripts/ 폴더를 agents/maintenance로 재분류, 일회성 디버그 스크립트 삭제"
```

---

### Task 1: Python 프로젝트 스캐폴딩

**Files:**
- Create: `scripts/crewai/requirements.txt`
- Create: `scripts/crewai/tests/__init__.py`
- Create: `scripts/crewai/tests/conftest.py`
- Create: `scripts/crewai/.env.example`

**Interfaces:**
- Produces: a `scripts/crewai/` directory where every module below (`tools.py`, `supabase_io.py`, `agents.py`, `tasks.py`, `crew.py`, `main.py`) lives as a flat module (no package `__init__.py` needed at that level), importable from `scripts/crewai/tests/` via `conftest.py` adding the parent directory to `sys.path`.

- [ ] **Step 1: Create the requirements file**

```text
crewai>=0.86.0
supabase>=2.9.0
python-dotenv>=1.0.1
requests>=2.32.0
pytest>=8.3.0
PyYAML>=6.0.2
```

- [ ] **Step 2: Create `conftest.py` so tests can import sibling modules as flat modules**

```python
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
```

- [ ] **Step 3: Create an empty `tests/__init__.py`**

```python
```

- [ ] **Step 4: Create `.env.example` documenting the required environment variables**

```text
GEMINI_API_KEY=
SUPABASE_URL=
SUPABASE_ANON_KEY=
AGENT_EMAIL=
AGENT_PASSWORD=
```

- [ ] **Step 5: Install dependencies and verify pytest collects (with zero tests) cleanly**

Run: `cd scripts/crewai && pip install -r requirements.txt && pytest --collect-only`
Expected: `no tests ran` with no collection errors

- [ ] **Step 6: Commit**

```bash
git add scripts/crewai/requirements.txt scripts/crewai/tests/__init__.py scripts/crewai/tests/conftest.py scripts/crewai/.env.example
git commit -m "chore: CrewAI 파이프라인용 Python 프로젝트 스캐폴딩"
```

---

### Task 2: `tools.py` — 순수 함수 (`extract_video_id`, `clean_video_title`)

**Files:**
- Create: `scripts/crewai/tools.py`
- Test: `scripts/crewai/tests/test_tools.py`

**Interfaces:**
- Produces: `extract_video_id(url: str) -> str | None`, `clean_video_title(title: str) -> str` — used by Task 4/5 (video fetching) to normalize titles/ids, ported 1:1 from `scripts/gas/quizrank_agent.js:468-474` (`extractVideoId_`) and `:745-756` (`cleanVideoTitle_`).

- [ ] **Step 1: Write the failing tests**

```python
# scripts/crewai/tests/test_tools.py
from tools import extract_video_id, clean_video_title


def test_extract_video_id_from_watch_url():
    assert extract_video_id("https://youtube.com/watch?v=abcDEF12345") == "abcDEF12345"


def test_extract_video_id_from_short_url():
    assert extract_video_id("https://youtu.be/abcDEF12345") == "abcDEF12345"


def test_extract_video_id_returns_none_for_invalid_url():
    assert extract_video_id("https://example.com/not-a-video") is None


def test_extract_video_id_returns_none_for_empty_string():
    assert extract_video_id("") is None


def test_clean_video_title_strips_brackets_and_parens():
    assert clean_video_title("NewJeans (뉴진스) 'Hype Boy' [MV]") == "NewJeans 'Hype Boy'"


def test_clean_video_title_strips_official_video_suffix():
    assert clean_video_title("BTS - Butter Official Music Video") == "BTS -"


def test_clean_video_title_strips_hashtags_and_collapses_spaces():
    assert clean_video_title("아이브 신곡   #shorts #kpop") == "아이브 신곡"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd scripts/crewai && pytest tests/test_tools.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'tools'`

- [ ] **Step 3: Implement the two functions**

```python
# scripts/crewai/tools.py
import re

_VIDEO_ID_PATTERNS = [
    re.compile(r"[?&]v=([a-zA-Z0-9_-]{11})"),
    re.compile(r"/([a-zA-Z0-9_-]{11})$"),
]


def extract_video_id(url: str) -> str | None:
    if not url:
        return None
    for pattern in _VIDEO_ID_PATTERNS:
        match = pattern.search(url)
        if match:
            return match.group(1)
    return None


def clean_video_title(title: str) -> str:
    if not title:
        return ""
    cleaned = title
    cleaned = re.sub(r"\[.*?\]", "", cleaned)
    cleaned = re.sub(r"\(.*?\)", "", cleaned)
    cleaned = re.sub(r"\|.*$", "", cleaned)
    cleaned = re.sub(
        r"[-–—].*?(official|mv|m/v|music video|lyrics|lyric)",
        "",
        cleaned,
        flags=re.IGNORECASE,
    )
    cleaned = re.sub(r"official\s*(music\s*)?video", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"#\S+", "", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned.strip()
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd scripts/crewai && pytest tests/test_tools.py -v`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add scripts/crewai/tools.py scripts/crewai/tests/test_tools.py
git commit -m "feat: CrewAI tools.py에 video_id/title 정규화 순수 함수 추가"
```

---

### Task 3: `tools.py` — `fetch_trending_keywords` (Google Trends RSS)

**Files:**
- Modify: `scripts/crewai/tools.py`
- Test: `scripts/crewai/tests/test_tools.py`

**Interfaces:**
- Consumes: nothing from earlier tasks (uses `requests`, stdlib `xml.etree.ElementTree`).
- Produces: `fetch_trending_keywords() -> list[str]` — used by Task 8 (`agents.py`, as a Planner tool). Ported from `scripts/gas/quizrank_agent.js:482-523` (`fetchTrendingKeywords_` + `getDefaultKeywords_`).

- [ ] **Step 1: Write the failing tests**

```python
# append to scripts/crewai/tests/test_tools.py
from unittest.mock import patch, Mock
import tools


SAMPLE_TRENDS_RSS = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<item><title>BTS 컴백</title></item>
<item><title>아이브 신곡</title></item>
</channel></rss>"""


def test_fetch_trending_keywords_parses_rss_titles():
    mock_resp = Mock(status_code=200, text=SAMPLE_TRENDS_RSS)
    with patch("tools.requests.get", return_value=mock_resp):
        keywords = tools.fetch_trending_keywords()
    assert keywords == ["BTS 컴백", "아이브 신곡"]


def test_fetch_trending_keywords_falls_back_on_non_200():
    mock_resp = Mock(status_code=500, text="")
    with patch("tools.requests.get", return_value=mock_resp):
        keywords = tools.fetch_trending_keywords()
    assert keywords == tools.DEFAULT_KEYWORDS


def test_fetch_trending_keywords_falls_back_on_request_exception():
    with patch("tools.requests.get", side_effect=tools.requests.RequestException("boom")):
        keywords = tools.fetch_trending_keywords()
    assert keywords == tools.DEFAULT_KEYWORDS
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd scripts/crewai && pytest tests/test_tools.py -v -k trending_keywords`
Expected: FAIL with `AttributeError: module 'tools' has no attribute 'fetch_trending_keywords'`

- [ ] **Step 3: Implement `fetch_trending_keywords`**

```python
# add to scripts/crewai/tools.py
import xml.etree.ElementTree as ET
import requests

TRENDS_RSS_URL = "https://trends.google.co.kr/trending/rss?geo=KR"

DEFAULT_KEYWORDS = [
    "BTS MV", "뉴진스 MV", "에스파 MV", "아이브 MV", "르세라핌 MV",
    "인기 드라마 OST", "인기 애니 OST", "롤 하이라이트",
    "발로란트 하이라이트", "원신 플레이", "핫한 예능 클립", "인기 유튜버",
    "K-POP 히트곡 MV", "넷플릭스 예고편", "인기 밈 영상",
    "축구 골 하이라이트", "야구 홈런 하이라이트", "먹방 영상",
    "인기 쇼츠", "챌린지 영상",
]

_REQUEST_HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}


def fetch_trending_keywords() -> list[str]:
    try:
        resp = requests.get(TRENDS_RSS_URL, headers=_REQUEST_HEADERS, timeout=10)
        if resp.status_code != 200:
            return DEFAULT_KEYWORDS
        root = ET.fromstring(resp.text)
        channel = root.find("channel")
        if channel is None:
            return DEFAULT_KEYWORDS
        keywords = [
            item.findtext("title").strip()
            for item in channel.findall("item")[:20]
            if item.findtext("title") and item.findtext("title").strip()
        ]
        return keywords or DEFAULT_KEYWORDS
    except (requests.RequestException, ET.ParseError):
        return DEFAULT_KEYWORDS
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd scripts/crewai && pytest tests/test_tools.py -v -k trending_keywords`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add scripts/crewai/tools.py scripts/crewai/tests/test_tools.py
git commit -m "feat: tools.py에 Google Trends RSS 키워드 수집 함수 추가"
```

---

### Task 4: `tools.py` — `fetch_trending_videos` (Piped → Invidious fallback)

**Files:**
- Modify: `scripts/crewai/tools.py`
- Test: `scripts/crewai/tests/test_tools.py`

**Interfaces:**
- Consumes: `extract_video_id` (Task 2)
- Produces: `fetch_trending_videos() -> list[dict]`, each item `{"video_id": str, "title": str, "thumbnail": str, "category": str}` — used by Task 8 (Planner/Writer tool). Ported from `scripts/gas/quizrank_agent.js:326-400` (`fetchTrendingVideos_`, GAS-only YouTube Advanced Service tier skipped since Python has no equivalent) and `:761-769` (`guessCategory_`).

- [ ] **Step 1: Write the failing tests**

```python
# append to scripts/crewai/tests/test_tools.py

PIPED_TRENDING_SAMPLE = [
    {"url": "/watch?v=aaaaaaaaaaa", "title": "NewJeans MV", "thumbnail": "https://img/a.jpg"},
    {"url": "/watch?v=bbbbbbbbbbb", "title": "롤 하이라이트", "thumbnail": "https://img/b.jpg"},
]

INVIDIOUS_TRENDING_SAMPLE = [
    {"videoId": "ccccccccccc", "title": "BTS 컴백 무대"},
]


def test_fetch_trending_videos_uses_piped_first():
    mock_resp = Mock(status_code=200)
    mock_resp.json.return_value = PIPED_TRENDING_SAMPLE
    with patch("tools.requests.get", return_value=mock_resp):
        videos = tools.fetch_trending_videos()
    assert videos[0] == {
        "video_id": "aaaaaaaaaaa",
        "title": "NewJeans MV",
        "thumbnail": "https://img/a.jpg",
        "category": "music",
    }
    assert videos[1]["category"] == "gaming"


def test_fetch_trending_videos_falls_back_to_invidious_when_piped_empty():
    piped_resp = Mock(status_code=200)
    piped_resp.json.return_value = []
    invidious_resp = Mock(status_code=200)
    invidious_resp.json.return_value = INVIDIOUS_TRENDING_SAMPLE

    def fake_get(url, *args, **kwargs):
        if "piped" in url or "pipedapi" in url:
            return piped_resp
        return invidious_resp

    with patch("tools.requests.get", side_effect=fake_get):
        videos = tools.fetch_trending_videos()
    assert videos == [{
        "video_id": "ccccccccccc",
        "title": "BTS 컴백 무대",
        "thumbnail": "https://i.ytimg.com/vi/ccccccccccc/hqdefault.jpg",
        "category": "music",
    }]


def test_fetch_trending_videos_returns_empty_list_when_all_sources_fail():
    with patch("tools.requests.get", side_effect=tools.requests.RequestException("boom")):
        videos = tools.fetch_trending_videos()
    assert videos == []
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd scripts/crewai && pytest tests/test_tools.py -v -k trending_videos`
Expected: FAIL with `AttributeError: module 'tools' has no attribute 'fetch_trending_videos'`

- [ ] **Step 3: Implement `guess_category` and `fetch_trending_videos`**

```python
# add to scripts/crewai/tools.py
PIPED_INSTANCES = [
    "https://pipedapi.kavin.rocks",
    "https://pipedapi.adminforge.de",
    "https://pipedapi.darkness.services",
]

INVIDIOUS_INSTANCES = [
    "https://inv.nadeko.net",
    "https://invidious.nerdvpn.de",
    "https://iv.nbooo.com",
]


def guess_category(title: str) -> str:
    if not title:
        return "trending"
    t = title.lower()
    if re.search(r"mv|music|뮤직|노래|song|album|feat\.|ft\.|remix", t, re.IGNORECASE):
        return "music"
    if re.search(r"game|게임|롤|발로란트|마크|원신|배그|오버워치|gameplay", t, re.IGNORECASE):
        return "gaming"
    if re.search(r"축구|야구|농구|스포츠|sport|goal|하이라이트|highlight", t, re.IGNORECASE):
        return "sports"
    if re.search(r"드라마|영화|예능|movie|drama|show|entertainment", t, re.IGNORECASE):
        return "entertainment"
    return "trending"


def fetch_trending_videos() -> list[dict]:
    for instance in PIPED_INSTANCES:
        try:
            resp = requests.get(
                f"{instance}/trending?region=KR", headers=_REQUEST_HEADERS, timeout=10
            )
            if resp.status_code != 200:
                continue
            raw_videos = resp.json()
            if not raw_videos:
                continue
            result = []
            for v in raw_videos[:50]:
                vid = extract_video_id(v.get("url", ""))
                if vid and v.get("title"):
                    result.append({
                        "video_id": vid,
                        "title": v["title"],
                        "thumbnail": v.get("thumbnail") or f"https://i.ytimg.com/vi/{vid}/hqdefault.jpg",
                        "category": guess_category(v["title"]),
                    })
            if result:
                return result
        except requests.RequestException:
            continue

    for instance in INVIDIOUS_INSTANCES:
        try:
            resp = requests.get(
                f"{instance}/api/v1/trending?region=KR", headers=_REQUEST_HEADERS, timeout=10
            )
            if resp.status_code != 200:
                continue
            raw_videos = resp.json()
            if not raw_videos:
                continue
            result = []
            for v in raw_videos[:50]:
                if v.get("videoId") and v.get("title"):
                    result.append({
                        "video_id": v["videoId"],
                        "title": v["title"],
                        "thumbnail": f"https://i.ytimg.com/vi/{v['videoId']}/hqdefault.jpg",
                        "category": guess_category(v["title"]),
                    })
            if result:
                return result
        except requests.RequestException:
            continue

    return []
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd scripts/crewai && pytest tests/test_tools.py -v -k trending_videos`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add scripts/crewai/tools.py scripts/crewai/tests/test_tools.py
git commit -m "feat: tools.py에 유튜브 트렌딩 영상 수집(Piped→Invidious 폴백) 추가"
```

---

### Task 5: `tools.py` — `search_youtube` (Piped → Invidious fallback)

**Files:**
- Modify: `scripts/crewai/tools.py`
- Test: `scripts/crewai/tests/test_tools.py`

**Interfaces:**
- Consumes: `extract_video_id` (Task 2)
- Produces: `search_youtube(query: str) -> dict | None`, `{"video_id": str, "title": str, "thumbnail": str}` — used by Task 8 (Writer tool, for grounding quiz answers/worldcup items to real videos when trending data alone is insufficient). Ported from `scripts/gas/quizrank_agent.js:408-466` (`searchYouTube_`, GAS-only tier skipped).

- [ ] **Step 1: Write the failing tests**

```python
# append to scripts/crewai/tests/test_tools.py

def test_search_youtube_uses_piped_first():
    mock_resp = Mock(status_code=200)
    mock_resp.json.return_value = {"items": [{"url": "/watch?v=ddddddddddd", "title": "검색결과"}]}
    with patch("tools.requests.get", return_value=mock_resp):
        result = tools.search_youtube("아이브")
    assert result == {
        "video_id": "ddddddddddd",
        "title": "검색결과",
        "thumbnail": "https://i.ytimg.com/vi/ddddddddddd/hqdefault.jpg",
    }


def test_search_youtube_falls_back_to_invidious():
    piped_resp = Mock(status_code=200)
    piped_resp.json.return_value = {"items": []}
    invidious_resp = Mock(status_code=200)
    invidious_resp.json.return_value = [{"videoId": "eeeeeeeeeee", "title": "인비디어스 결과"}]

    def fake_get(url, *args, **kwargs):
        if "piped" in url:
            return piped_resp
        return invidious_resp

    with patch("tools.requests.get", side_effect=fake_get):
        result = tools.search_youtube("롤")
    assert result["video_id"] == "eeeeeeeeeee"


def test_search_youtube_returns_none_when_all_sources_fail():
    with patch("tools.requests.get", side_effect=tools.requests.RequestException("boom")):
        assert tools.search_youtube("아무거나") is None
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd scripts/crewai && pytest tests/test_tools.py -v -k search_youtube`
Expected: FAIL with `AttributeError: module 'tools' has no attribute 'search_youtube'`

- [ ] **Step 3: Implement `search_youtube`**

```python
# add to scripts/crewai/tools.py
from urllib.parse import quote


def search_youtube(query: str) -> dict | None:
    encoded = quote(query)

    for instance in PIPED_INSTANCES:
        try:
            resp = requests.get(
                f"{instance}/search?q={encoded}&filter=videos",
                headers=_REQUEST_HEADERS,
                timeout=10,
            )
            if resp.status_code != 200:
                continue
            data = resp.json()
            items = data.get("items", data) if isinstance(data, dict) else data
            if not items:
                continue
            for item in items[:5]:
                vid = extract_video_id(item.get("url", ""))
                if vid and item.get("title"):
                    return {
                        "video_id": vid,
                        "title": item["title"],
                        "thumbnail": f"https://i.ytimg.com/vi/{vid}/hqdefault.jpg",
                    }
        except requests.RequestException:
            continue

    for instance in INVIDIOUS_INSTANCES:
        try:
            resp = requests.get(
                f"{instance}/api/v1/search?q={encoded}&type=video",
                headers=_REQUEST_HEADERS,
                timeout=10,
            )
            if resp.status_code != 200:
                continue
            items = resp.json()
            if not items:
                continue
            for item in items[:5]:
                if item.get("videoId") and item.get("title"):
                    return {
                        "video_id": item["videoId"],
                        "title": item["title"],
                        "thumbnail": f"https://i.ytimg.com/vi/{item['videoId']}/hqdefault.jpg",
                    }
        except requests.RequestException:
            continue

    return None
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd scripts/crewai && pytest tests/test_tools.py -v -k search_youtube`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add scripts/crewai/tools.py scripts/crewai/tests/test_tools.py
git commit -m "feat: tools.py에 유튜브 검색(Piped→Invidious 폴백) 추가"
```

---

### Task 6: `tools.py` — `validate_quiz` / `validate_worldcup`

**Files:**
- Modify: `scripts/crewai/tools.py`
- Test: `scripts/crewai/tests/test_tools.py`

**Interfaces:**
- Consumes: nothing from earlier tasks (pure validation logic).
- Produces: `validate_quiz(data: dict) -> tuple[bool, str]`, `validate_worldcup(data: dict) -> tuple[bool, str]` — used by Task 8 (Reviewer agent's tool) and Task 10 (`crew.py`, as a safety net even if the Reviewer agent's own verdict says APPROVE). Returns `(True, "")` on success, `(False, "<reason>")` on the first failing rule.

Expected JSON shapes these validate:
- Quiz: `{"title": str, "description": str, "questions": [{"video_id": str, "answer": str, "options": [{"id": "A", "text": str, "isCorrect": bool}, ...4 total]}, ...]}`
- Worldcup: `{"title": str, "description": str, "items": [{"name": str, "image_url": str}, ...]}`

- [ ] **Step 1: Write the failing tests**

```python
# append to scripts/crewai/tests/test_tools.py

def _valid_quiz():
    return {
        "title": "테스트 퀴즈",
        "description": "설" * 150,  # 300자
        "questions": [
            {
                "video_id": f"vid{i:08d}",
                "answer": f"정답{i}",
                "options": [
                    {"id": "A", "text": f"정답{i}", "isCorrect": True},
                    {"id": "B", "text": "오답1", "isCorrect": False},
                    {"id": "C", "text": "오답2", "isCorrect": False},
                    {"id": "D", "text": "오답3", "isCorrect": False},
                ],
            }
            for i in range(4)
        ],
    }


def _valid_worldcup():
    return {
        "title": "테스트 월드컵",
        "description": "설" * 150,
        "items": [{"name": f"후보{i}", "image_url": f"https://img/{i}.jpg"} for i in range(8)],
    }


def test_validate_quiz_accepts_valid_data():
    ok, reason = tools.validate_quiz(_valid_quiz())
    assert ok is True
    assert reason == ""


def test_validate_quiz_rejects_short_description():
    data = _valid_quiz()
    data["description"] = "너무 짧음"
    ok, reason = tools.validate_quiz(data)
    assert ok is False
    assert "설명" in reason


def test_validate_quiz_rejects_too_few_questions():
    data = _valid_quiz()
    data["questions"] = data["questions"][:2]
    ok, reason = tools.validate_quiz(data)
    assert ok is False
    assert "문항" in reason


def test_validate_quiz_rejects_question_without_exactly_one_correct_option():
    data = _valid_quiz()
    data["questions"][0]["options"][1]["isCorrect"] = True  # now two correct
    ok, reason = tools.validate_quiz(data)
    assert ok is False
    assert "옵션" in reason


def test_validate_quiz_rejects_missing_video_id():
    data = _valid_quiz()
    data["questions"][0]["video_id"] = ""
    ok, reason = tools.validate_quiz(data)
    assert ok is False
    assert "video_id" in reason


def test_validate_worldcup_accepts_valid_data():
    ok, reason = tools.validate_worldcup(_valid_worldcup())
    assert ok is True
    assert reason == ""


def test_validate_worldcup_rejects_too_few_items():
    data = _valid_worldcup()
    data["items"] = data["items"][:3]
    ok, reason = tools.validate_worldcup(data)
    assert ok is False
    assert "후보" in reason


def test_validate_worldcup_rejects_missing_image_url():
    data = _valid_worldcup()
    data["items"][0]["image_url"] = ""
    ok, reason = tools.validate_worldcup(data)
    assert ok is False
    assert "image_url" in reason
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd scripts/crewai && pytest tests/test_tools.py -v -k validate_`
Expected: FAIL with `AttributeError: module 'tools' has no attribute 'validate_quiz'`

- [ ] **Step 3: Implement the validators**

```python
# add to scripts/crewai/tools.py
MIN_DESCRIPTION_LENGTH = 300
QUIZ_MIN_QUESTIONS = 4
WORLDCUP_MIN_ITEMS = 8


def validate_quiz(data: dict) -> tuple[bool, str]:
    if not data.get("title"):
        return False, "제목이 비어있음"
    if len(data.get("description", "")) < MIN_DESCRIPTION_LENGTH:
        return False, f"설명이 {MIN_DESCRIPTION_LENGTH}자 미만"
    questions = data.get("questions", [])
    if len(questions) < QUIZ_MIN_QUESTIONS:
        return False, f"문항 수가 {QUIZ_MIN_QUESTIONS}개 미만"
    for q in questions:
        if not q.get("video_id"):
            return False, "문항에 video_id 누락"
        options = q.get("options", [])
        if len(options) != 4:
            return False, "옵션이 4개가 아님"
        correct_count = sum(1 for o in options if o.get("isCorrect"))
        if correct_count != 1:
            return False, "옵션 중 정답이 정확히 1개가 아님"
    return True, ""


def validate_worldcup(data: dict) -> tuple[bool, str]:
    if not data.get("title"):
        return False, "제목이 비어있음"
    if len(data.get("description", "")) < MIN_DESCRIPTION_LENGTH:
        return False, f"설명이 {MIN_DESCRIPTION_LENGTH}자 미만"
    items = data.get("items", [])
    if len(items) < WORLDCUP_MIN_ITEMS:
        return False, f"후보가 {WORLDCUP_MIN_ITEMS}개 미만"
    for item in items:
        if not item.get("image_url"):
            return False, "후보에 image_url 누락"
        if not item.get("name"):
            return False, "후보에 name 누락"
    return True, ""
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd scripts/crewai && pytest tests/test_tools.py -v -k validate_`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add scripts/crewai/tools.py scripts/crewai/tests/test_tools.py
git commit -m "feat: tools.py에 퀴즈/월드컵 JSON 스키마 검증 함수 추가"
```

---

### Task 7: `supabase_io.py`

**Files:**
- Create: `scripts/crewai/supabase_io.py`
- Test: `scripts/crewai/tests/test_supabase_io.py`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `get_authenticated_client() -> tuple[Client, str]` (returns `(client, user_id)`), `insert_quiz(client: Client, data: dict, user_id: str) -> str`, `insert_worldcup(client: Client, data: dict, user_id: str) -> str` — used by Task 11 (`main.py`). Mirrors `getSupabaseToken_`/`insertQuizToDB_`/`insertWorldcupToDB_` in `scripts/gas/quizrank_agent.js:897-965`.

- [ ] **Step 1: Write the failing tests**

```python
# scripts/crewai/tests/test_supabase_io.py
from unittest.mock import MagicMock
import supabase_io


def _quiz_data():
    return {
        "title": "테스트 퀴즈",
        "description": "설명",
        "questions": [
            {
                "video_id": "vid1",
                "answer": "정답1",
                "options": [
                    {"id": "A", "text": "정답1", "isCorrect": True},
                    {"id": "B", "text": "오답1", "isCorrect": False},
                    {"id": "C", "text": "오답2", "isCorrect": False},
                    {"id": "D", "text": "오답3", "isCorrect": False},
                ],
            }
        ],
    }


def _worldcup_data():
    return {
        "title": "테스트 월드컵",
        "description": "설명",
        "items": [{"name": "후보1", "image_url": "https://img/1.jpg"}],
    }


def test_insert_quiz_creates_quiz_row_then_question_rows():
    client = MagicMock()
    quiz_insert_result = MagicMock()
    quiz_insert_result.data = [{"id": "quiz-123"}]
    client.table.return_value.insert.return_value.execute.side_effect = [
        quiz_insert_result,
        MagicMock(),
    ]

    quiz_id = supabase_io.insert_quiz(client, _quiz_data(), user_id="user-1")

    assert quiz_id == "quiz-123"
    first_call = client.table.call_args_list[0]
    assert first_call.args[0] == "quizzes"
    quiz_row = client.table.return_value.insert.call_args_list[0].args[0]
    assert quiz_row == {"title": "테스트 퀴즈", "description": "설명", "creator_id": "user-1"}

    second_call = client.table.call_args_list[1]
    assert second_call.args[0] == "quiz_questions"
    question_rows = client.table.return_value.insert.call_args_list[1].args[0]
    assert question_rows == [{
        "quiz_id": "quiz-123",
        "video_id": "vid1",
        "start_time": 30,
        "end_time": 45,
        "answer": "정답1",
        "options": _quiz_data()["questions"][0]["options"],
        "is_embeddable": True,
    }]


def test_insert_worldcup_creates_worldcup_row_then_item_rows():
    client = MagicMock()
    wc_insert_result = MagicMock()
    wc_insert_result.data = [{"id": "wc-456"}]
    client.table.return_value.insert.return_value.execute.side_effect = [
        wc_insert_result,
        MagicMock(),
    ]

    wc_id = supabase_io.insert_worldcup(client, _worldcup_data(), user_id="user-1")

    assert wc_id == "wc-456"
    wc_row = client.table.return_value.insert.call_args_list[0].args[0]
    assert wc_row == {
        "title": "테스트 월드컵",
        "description": "설명",
        "play_count": 0,
        "creator_id": "user-1",
    }
    item_rows = client.table.return_value.insert.call_args_list[1].args[0]
    assert item_rows == [{"worldcup_id": "wc-456", "name": "후보1", "image_url": "https://img/1.jpg"}]
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd scripts/crewai && pytest tests/test_supabase_io.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'supabase_io'`

- [ ] **Step 3: Implement `supabase_io.py`**

```python
# scripts/crewai/supabase_io.py
import os
from supabase import create_client, Client


def get_authenticated_client() -> tuple[Client, str]:
    client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_ANON_KEY"])
    auth_response = client.auth.sign_in_with_password({
        "email": os.environ["AGENT_EMAIL"],
        "password": os.environ["AGENT_PASSWORD"],
    })
    return client, auth_response.user.id


def insert_quiz(client: Client, data: dict, user_id: str) -> str:
    quiz_row = {
        "title": data["title"],
        "description": data.get("description", ""),
        "creator_id": user_id,
    }
    quiz_result = client.table("quizzes").insert(quiz_row).execute()
    quiz_id = quiz_result.data[0]["id"]

    question_rows = [
        {
            "quiz_id": quiz_id,
            "video_id": q["video_id"],
            "start_time": 30,
            "end_time": 45,
            "answer": q["answer"],
            "options": q["options"],
            "is_embeddable": True,
        }
        for q in data["questions"]
    ]
    client.table("quiz_questions").insert(question_rows).execute()
    return quiz_id


def insert_worldcup(client: Client, data: dict, user_id: str) -> str:
    worldcup_row = {
        "title": data["title"],
        "description": data.get("description", ""),
        "play_count": 0,
        "creator_id": user_id,
    }
    worldcup_result = client.table("worldcups").insert(worldcup_row).execute()
    worldcup_id = worldcup_result.data[0]["id"]

    item_rows = [
        {"worldcup_id": worldcup_id, "name": item["name"], "image_url": item["image_url"]}
        for item in data["items"]
    ]
    client.table("worldcup_items").insert(item_rows).execute()
    return worldcup_id
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd scripts/crewai && pytest tests/test_supabase_io.py -v`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add scripts/crewai/supabase_io.py scripts/crewai/tests/test_supabase_io.py
git commit -m "feat: Supabase 인증 및 퀴즈/월드컵 insert 모듈 추가"
```

---

### Task 8: `agents.py`

**Files:**
- Create: `scripts/crewai/agents.py`
- Test: `scripts/crewai/tests/test_agents.py`

**Interfaces:**
- Consumes: `fetch_trending_keywords`, `fetch_trending_videos`, `search_youtube`, `validate_quiz`, `validate_worldcup` (Task 2-6, wrapped as CrewAI tools).
- Produces: `build_agents() -> dict[str, Agent]` with keys `"planner"`, `"writer"`, `"seo"`, `"reviewer"` — used by Task 9 (`tasks.py`) and Task 10 (`crew.py`). Reads `GEMINI_API_KEY` and optional `GEMINI_MODEL` (default `"gemini/gemini-2.0-flash"`) from the environment.

- [ ] **Step 1: Write the failing tests**

```python
# scripts/crewai/tests/test_agents.py
import os
import agents


def test_build_agents_returns_all_four_roles(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "dummy-key-for-construction-only")
    result = agents.build_agents()
    assert set(result.keys()) == {"planner", "writer", "seo", "reviewer"}


def test_planner_and_writer_have_trend_and_search_tools(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "dummy-key-for-construction-only")
    result = agents.build_agents()
    planner_tool_names = {t.name for t in result["planner"].tools}
    writer_tool_names = {t.name for t in result["writer"].tools}
    assert "fetch_trending_keywords" in planner_tool_names
    assert "fetch_trending_videos" in planner_tool_names
    assert "search_youtube" in writer_tool_names


def test_reviewer_has_validation_tools(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "dummy-key-for-construction-only")
    result = agents.build_agents()
    reviewer_tool_names = {t.name for t in result["reviewer"].tools}
    assert "validate_quiz" in reviewer_tool_names
    assert "validate_worldcup" in reviewer_tool_names
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd scripts/crewai && pytest tests/test_agents.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'agents'`

- [ ] **Step 3: Implement `agents.py`**

```python
# scripts/crewai/agents.py
import os
from crewai import Agent, LLM
from crewai.tools import tool

import tools as content_tools


@tool("fetch_trending_keywords")
def fetch_trending_keywords_tool() -> list[str]:
    """오늘의 구글 트렌드 인기 검색어(한국)를 최대 20개 가져온다."""
    return content_tools.fetch_trending_keywords()


@tool("fetch_trending_videos")
def fetch_trending_videos_tool() -> list[dict]:
    """오늘의 유튜브 트렌딩 영상(한국)을 video_id/title/thumbnail/category와 함께 가져온다."""
    return content_tools.fetch_trending_videos()


@tool("search_youtube")
def search_youtube_tool(query: str) -> dict | None:
    """주어진 검색어로 실제 유튜브 영상 하나를 검색해 video_id/title/thumbnail을 반환한다."""
    return content_tools.search_youtube(query)


@tool("validate_quiz")
def validate_quiz_tool(data: dict) -> str:
    """퀴즈 JSON이 스키마(설명 300자 이상, 문항 4개 이상, 옵션 4개 중 정답 1개, video_id 존재)를 만족하는지 검사한다."""
    ok, reason = content_tools.validate_quiz(data)
    return "OK" if ok else f"INVALID: {reason}"


@tool("validate_worldcup")
def validate_worldcup_tool(data: dict) -> str:
    """월드컵 JSON이 스키마(설명 300자 이상, 후보 8개 이상, image_url 존재)를 만족하는지 검사한다."""
    ok, reason = content_tools.validate_worldcup(data)
    return "OK" if ok else f"INVALID: {reason}"


def _llm() -> LLM:
    return LLM(
        model=os.environ.get("GEMINI_MODEL", "gemini/gemini-2.0-flash"),
        api_key=os.environ["GEMINI_API_KEY"],
    )


def build_agents() -> dict[str, Agent]:
    llm = _llm()

    planner = Agent(
        role="콘텐츠 기획자",
        goal="오늘 가장 반응이 좋을 만한 퀴즈/월드컵 주제와 앵글을 트렌드 데이터에 기반해 선정한다",
        backstory="한국 유튜브/구글 트렌드 데이터를 매일 분석해온 바이럴 콘텐츠 기획 전문가",
        tools=[fetch_trending_keywords_tool, fetch_trending_videos_tool],
        llm=llm,
        verbose=True,
    )

    writer = Agent(
        role="콘텐츠 작성자",
        goal="기획안을 받아 제목, 300자 이상 설명, 퀴즈 문항 또는 월드컵 후보를 실제 영상 데이터에 근거해 작성한다",
        backstory="퀴즈/이상형 월드컵 콘텐츠를 다수 제작한 카피라이터. video_id와 image_url은 절대 지어내지 않고 항상 도구로 조회한 실제 값만 사용한다",
        tools=[search_youtube_tool],
        llm=llm,
        verbose=True,
    )

    seo = Agent(
        role="SEO 전문가",
        goal="제목과 설명을 검색 유입 관점에서 다듬는다 (문항/후보 데이터 구조는 절대 변경하지 않는다)",
        backstory="한국어 검색 트렌드와 클릭률에 정통한 SEO 카피 전문가",
        llm=llm,
        verbose=True,
    )

    reviewer = Agent(
        role="검수자",
        goal="완성된 콘텐츠가 스키마를 만족하는지 검증하고 APPROVE 또는 REVISE(사유)를 판정한다",
        backstory="퀴즈/월드컵 콘텐츠 품질 기준을 엄격하게 적용하는 QA 담당자",
        tools=[validate_quiz_tool, validate_worldcup_tool],
        llm=llm,
        verbose=True,
    )

    return {"planner": planner, "writer": writer, "seo": seo, "reviewer": reviewer}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd scripts/crewai && pytest tests/test_agents.py -v`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add scripts/crewai/agents.py scripts/crewai/tests/test_agents.py
git commit -m "feat: 기획자/작성자/SEO/검수자 4개 CrewAI 에이전트 정의"
```

---

### Task 9: `tasks.py`

**Files:**
- Create: `scripts/crewai/tasks.py`
- Test: `scripts/crewai/tests/test_tasks.py`

**Interfaces:**
- Consumes: `dict[str, Agent]` shape produced by `build_agents()` (Task 8) — keys `"planner"`, `"writer"`, `"seo"`, `"reviewer"`.
- Produces: `build_tasks(content_type: str, agent_map: dict, feedback: str | None = None) -> list[Task]` — a 4-item list `[plan_task, write_task, seo_task, review_task]` in that order, each `Task.agent` set to the matching agent from `agent_map`, and (for CrewAI's sequential process) each task after the first implicitly uses prior tasks' outputs as context. Used by Task 10 (`crew.py`). The final (`review_task`) has `expected_output` describing the `{"verdict": "APPROVE"|"REVISE", "reason": str, "data": {...}}` JSON contract that `crew.py` parses.

- [ ] **Step 1: Write the failing tests**

```python
# scripts/crewai/tests/test_tasks.py
from unittest.mock import MagicMock
import tasks


def _fake_agent_map():
    return {
        "planner": MagicMock(name="planner_agent"),
        "writer": MagicMock(name="writer_agent"),
        "seo": MagicMock(name="seo_agent"),
        "reviewer": MagicMock(name="reviewer_agent"),
    }


def test_build_tasks_returns_four_tasks_in_order():
    agent_map = _fake_agent_map()
    result = tasks.build_tasks("quiz", agent_map)
    assert len(result) == 4
    assert result[0].agent is agent_map["planner"]
    assert result[1].agent is agent_map["writer"]
    assert result[2].agent is agent_map["seo"]
    assert result[3].agent is agent_map["reviewer"]


def test_build_tasks_mentions_content_type_in_write_task_description():
    agent_map = _fake_agent_map()
    quiz_tasks = tasks.build_tasks("quiz", agent_map)
    worldcup_tasks = tasks.build_tasks("worldcup", agent_map)
    assert "퀴즈" in quiz_tasks[1].description
    assert "월드컵" in worldcup_tasks[1].description


def test_build_tasks_includes_feedback_in_write_task_when_revising():
    agent_map = _fake_agent_map()
    result = tasks.build_tasks("quiz", agent_map, feedback="설명이 너무 짧음")
    assert "설명이 너무 짧음" in result[1].description


def test_build_tasks_rejects_unknown_content_type():
    agent_map = _fake_agent_map()
    try:
        tasks.build_tasks("tierlist", agent_map)
        assert False, "should have raised"
    except ValueError:
        pass
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd scripts/crewai && pytest tests/test_tasks.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'tasks'`

- [ ] **Step 3: Implement `tasks.py`**

```python
# scripts/crewai/tasks.py
from crewai import Agent, Task

_CONTENT_LABELS = {"quiz": "퀴즈", "worldcup": "월드컵"}

_WRITE_INSTRUCTIONS = {
    "quiz": (
        "기획안의 주제로 퀴즈 문항을 최소 4개 작성해라. 각 문항은 search_youtube 도구로 실제 영상을 찾아 "
        "그 영상의 title을 answer로, video_id를 그대로 사용해라. 각 문항은 4개의 선택지(A~D)를 가지며 "
        "정답 1개(isCorrect: true)와 오답 3개(isCorrect: false)로 구성해라. video_id나 image_url을 "
        "직접 지어내지 마라 — 반드시 도구가 반환한 값만 사용해라."
    ),
    "worldcup": (
        "기획안의 주제로 월드컵 후보를 최소 8개 작성해라. 각 후보는 search_youtube 도구로 찾은 실제 영상의 "
        "제목을 name으로, 썸네일 URL을 image_url로 사용해라. image_url을 직접 지어내지 마라 — 반드시 "
        "도구가 반환한 값만 사용해라."
    ),
}

_EXPECTED_WRITE_OUTPUT = {
    "quiz": (
        '{"title": str, "description": str(300자 이상), "questions": '
        '[{"video_id": str, "answer": str, "options": [{"id": "A".."D", "text": str, "isCorrect": bool}]}]}'
    ),
    "worldcup": (
        '{"title": str, "description": str(300자 이상), "items": [{"name": str, "image_url": str}]}'
    ),
}


def build_tasks(content_type: str, agent_map: dict[str, Agent], feedback: str | None = None) -> list[Task]:
    if content_type not in _CONTENT_LABELS:
        raise ValueError(f"unsupported content_type: {content_type}")

    label = _CONTENT_LABELS[content_type]

    plan_task = Task(
        description=(
            f"fetch_trending_keywords와 fetch_trending_videos 도구를 사용해 오늘 한국에서 가장 반응이 "
            f"좋을 만한 {label} 주제와 앵글을 하나 선정해라. 왜 이 주제가 지금 반응이 좋을지 근거를 함께 제시해라."
        ),
        expected_output="선정한 주제, 앵글, 선정 근거를 담은 짧은 기획 메모",
        agent=agent_map["planner"],
    )

    write_description = f"기획자의 기획 메모를 바탕으로 {label} 콘텐츠 초안을 작성해라. {_WRITE_INSTRUCTIONS[content_type]}"
    if feedback:
        write_description += f" 이전 시도가 다음 사유로 반려되었다 — 반드시 고쳐서 다시 작성해라: {feedback}"

    write_task = Task(
        description=write_description,
        expected_output=_EXPECTED_WRITE_OUTPUT[content_type],
        agent=agent_map["writer"],
    )

    seo_task = Task(
        description=(
            "작성자가 만든 콘텐츠의 title과 description만 검색 유입 관점에서 다듬어라. "
            "questions/items 등 다른 필드는 절대 변경하지 말고 그대로 유지해라."
        ),
        expected_output=_EXPECTED_WRITE_OUTPUT[content_type],
        agent=agent_map["seo"],
    )

    review_task = Task(
        description=(
            f"validate_{content_type} 도구로 최종 {label} JSON을 검증해라. 통과하면 verdict를 APPROVE로, "
            "실패하면 REVISE로 설정하고 reason에 실패 사유를 적어라."
        ),
        expected_output=(
            '{"verdict": "APPROVE" 또는 "REVISE", "reason": str, "data": <검증 대상 JSON>}'
        ),
        agent=agent_map["reviewer"],
    )

    return [plan_task, write_task, seo_task, review_task]
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd scripts/crewai && pytest tests/test_tasks.py -v`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add scripts/crewai/tasks.py scripts/crewai/tests/test_tasks.py
git commit -m "feat: 콘텐츠 타입별 4단계 Task 정의 추가"
```

---

### Task 10: `crew.py`

**Files:**
- Create: `scripts/crewai/crew.py`
- Test: `scripts/crewai/tests/test_crew.py`

**Interfaces:**
- Consumes: `build_agents()` (Task 8), `build_tasks(content_type, agent_map, feedback)` (Task 9).
- Produces: `run_content_pipeline(content_type: str, max_retries: int = 2) -> dict | None` — returns the approved content `data` dict, or `None` if still rejected after `max_retries` revisions. Used by Task 11 (`main.py`).

- [ ] **Step 1: Write the failing tests**

```python
# scripts/crewai/tests/test_crew.py
import json
from unittest.mock import patch, MagicMock
import crew


def _kickoff_result(verdict: str, reason: str = "", data: dict | None = None):
    result = MagicMock()
    result.raw = json.dumps({"verdict": verdict, "reason": reason, "data": data or {"title": "x"}})
    return result


@patch("crew.Crew")
@patch("crew.build_tasks")
@patch("crew.build_agents")
def test_run_content_pipeline_returns_data_on_immediate_approve(mock_build_agents, mock_build_tasks, mock_crew_cls):
    mock_build_agents.return_value = {"planner": MagicMock(), "writer": MagicMock(), "seo": MagicMock(), "reviewer": MagicMock()}
    mock_build_tasks.return_value = [MagicMock() for _ in range(4)]
    mock_crew_cls.return_value.kickoff.return_value = _kickoff_result("APPROVE", data={"title": "승인됨"})

    result = crew.run_content_pipeline("quiz")

    assert result == {"title": "승인됨"}
    assert mock_crew_cls.return_value.kickoff.call_count == 1


@patch("crew.Crew")
@patch("crew.build_tasks")
@patch("crew.build_agents")
def test_run_content_pipeline_retries_once_then_approves(mock_build_agents, mock_build_tasks, mock_crew_cls):
    mock_build_agents.return_value = {"planner": MagicMock(), "writer": MagicMock(), "seo": MagicMock(), "reviewer": MagicMock()}
    mock_build_tasks.return_value = [MagicMock() for _ in range(4)]
    mock_crew_cls.return_value.kickoff.side_effect = [
        _kickoff_result("REVISE", reason="설명이 짧음"),
        _kickoff_result("APPROVE", data={"title": "재작성 후 승인"}),
    ]

    result = crew.run_content_pipeline("quiz", max_retries=2)

    assert result == {"title": "재작성 후 승인"}
    assert mock_crew_cls.return_value.kickoff.call_count == 2
    second_call_feedback = mock_build_tasks.call_args_list[1].kwargs.get("feedback") or mock_build_tasks.call_args_list[1].args[2]
    assert second_call_feedback == "설명이 짧음"


@patch("crew.Crew")
@patch("crew.build_tasks")
@patch("crew.build_agents")
def test_run_content_pipeline_returns_none_after_exceeding_max_retries(mock_build_agents, mock_build_tasks, mock_crew_cls):
    mock_build_agents.return_value = {"planner": MagicMock(), "writer": MagicMock(), "seo": MagicMock(), "reviewer": MagicMock()}
    mock_build_tasks.return_value = [MagicMock() for _ in range(4)]
    mock_crew_cls.return_value.kickoff.return_value = _kickoff_result("REVISE", reason="계속 실패")

    result = crew.run_content_pipeline("quiz", max_retries=2)

    assert result is None
    assert mock_crew_cls.return_value.kickoff.call_count == 3  # 최초 시도 + 재시도 2회


@patch("crew.Crew")
@patch("crew.build_tasks")
@patch("crew.build_agents")
def test_run_content_pipeline_skips_immediately_on_kickoff_exception(mock_build_agents, mock_build_tasks, mock_crew_cls):
    # Gemini 429 등 kickoff() 자체가 예외를 던지는 경우 — 재시도로 같은 오류를 반복하지 않고 즉시 스킵
    mock_build_agents.return_value = {"planner": MagicMock(), "writer": MagicMock(), "seo": MagicMock(), "reviewer": MagicMock()}
    mock_build_tasks.return_value = [MagicMock() for _ in range(4)]
    mock_crew_cls.return_value.kickoff.side_effect = RuntimeError("429 quota exceeded")

    result = crew.run_content_pipeline("quiz", max_retries=2)

    assert result is None
    assert mock_crew_cls.return_value.kickoff.call_count == 1


@patch("crew.Crew")
@patch("crew.build_tasks")
@patch("crew.build_agents")
def test_run_content_pipeline_skips_immediately_on_malformed_json(mock_build_agents, mock_build_tasks, mock_crew_cls):
    mock_build_agents.return_value = {"planner": MagicMock(), "writer": MagicMock(), "seo": MagicMock(), "reviewer": MagicMock()}
    mock_build_tasks.return_value = [MagicMock() for _ in range(4)]
    bad_result = MagicMock()
    bad_result.raw = "이건 JSON이 아님"
    mock_crew_cls.return_value.kickoff.return_value = bad_result

    result = crew.run_content_pipeline("quiz", max_retries=2)

    assert result is None
    assert mock_crew_cls.return_value.kickoff.call_count == 1
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd scripts/crewai && pytest tests/test_crew.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'crew'`

- [ ] **Step 3: Implement `crew.py`**

```python
# scripts/crewai/crew.py
import json
from crewai import Crew, Process

from agents import build_agents
from tasks import build_tasks


def run_content_pipeline(content_type: str, max_retries: int = 2) -> dict | None:
    agent_map = build_agents()
    feedback = None

    for attempt in range(max_retries + 1):
        task_list = build_tasks(content_type, agent_map, feedback)
        crew_instance = Crew(
            agents=list(agent_map.values()),
            tasks=task_list,
            process=Process.sequential,
        )
        try:
            result = crew_instance.kickoff()
            parsed = json.loads(result.raw)
        except Exception as exc:
            # Gemini 429 등 실행 자체가 실패하면 같은 오류를 반복할 뿐이므로
            # 재시도하지 않고 이 콘텐츠 타입을 즉시 스킵한다.
            print(f"[crew] {content_type} 파이프라인 실패, 스킵: {exc}")
            return None

        if parsed["verdict"] == "APPROVE":
            return parsed["data"]

        feedback = parsed.get("reason", "사유 없음")

    return None
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd scripts/crewai && pytest tests/test_crew.py -v`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add scripts/crewai/crew.py scripts/crewai/tests/test_crew.py
git commit -m "feat: 검수 반려 시 최대 2회 재시도하는 Crew 오케스트레이션 추가"
```

---

### Task 11: `main.py`

**Files:**
- Create: `scripts/crewai/main.py`
- Test: `scripts/crewai/tests/test_main.py`

**Interfaces:**
- Consumes: `run_content_pipeline(content_type, max_retries)` (Task 10), `get_authenticated_client()`, `insert_quiz(client, data, user_id)`, `insert_worldcup(client, data, user_id)` (Task 7).
- Produces: `run(dry_run: bool = False) -> list[dict]` — a summary list, one entry per content type: `{"content_type": str, "status": "success"|"skipped", "title": str | None, "id": str | None}`. Called from the `if __name__ == "__main__":` block with `--dry-run` parsed via `argparse`.

- [ ] **Step 1: Write the failing tests**

```python
# scripts/crewai/tests/test_main.py
from unittest.mock import patch, MagicMock
import main


@patch("main.insert_worldcup")
@patch("main.insert_quiz")
@patch("main.get_authenticated_client")
@patch("main.run_content_pipeline")
def test_run_inserts_approved_content_for_each_type(mock_pipeline, mock_get_client, mock_insert_quiz, mock_insert_worldcup):
    mock_get_client.return_value = (MagicMock(), "user-1")
    mock_pipeline.side_effect = [
        {"title": "퀴즈 제목"},
        {"title": "월드컵 제목"},
    ]
    mock_insert_quiz.return_value = "quiz-id-1"
    mock_insert_worldcup.return_value = "wc-id-1"

    summary = main.run(dry_run=False)

    assert summary == [
        {"content_type": "quiz", "status": "success", "title": "퀴즈 제목", "id": "quiz-id-1"},
        {"content_type": "worldcup", "status": "success", "title": "월드컵 제목", "id": "wc-id-1"},
    ]
    mock_insert_quiz.assert_called_once()
    mock_insert_worldcup.assert_called_once()


@patch("main.insert_worldcup")
@patch("main.insert_quiz")
@patch("main.get_authenticated_client")
@patch("main.run_content_pipeline")
def test_run_marks_content_type_skipped_when_pipeline_returns_none(mock_pipeline, mock_get_client, mock_insert_quiz, mock_insert_worldcup):
    mock_get_client.return_value = (MagicMock(), "user-1")
    mock_pipeline.side_effect = [None, {"title": "월드컵 제목"}]
    mock_insert_worldcup.return_value = "wc-id-1"

    summary = main.run(dry_run=False)

    assert summary[0] == {"content_type": "quiz", "status": "skipped", "title": None, "id": None}
    mock_insert_quiz.assert_not_called()


@patch("main.insert_worldcup")
@patch("main.insert_quiz")
@patch("main.get_authenticated_client")
@patch("main.run_content_pipeline")
def test_run_dry_run_skips_supabase_insert(mock_pipeline, mock_get_client, mock_insert_quiz, mock_insert_worldcup):
    mock_get_client.return_value = (MagicMock(), "user-1")
    mock_pipeline.side_effect = [{"title": "퀴즈 제목"}, {"title": "월드컵 제목"}]

    summary = main.run(dry_run=True)

    assert summary[0]["status"] == "success"
    assert summary[0]["id"] is None
    mock_insert_quiz.assert_not_called()
    mock_insert_worldcup.assert_not_called()
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd scripts/crewai && pytest tests/test_main.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'main'`

- [ ] **Step 3: Implement `main.py`**

```python
# scripts/crewai/main.py
import argparse

from crew import run_content_pipeline
from supabase_io import get_authenticated_client, insert_quiz, insert_worldcup

CONTENT_TYPES = ["quiz", "worldcup"]

_INSERTERS = {"quiz": insert_quiz, "worldcup": insert_worldcup}


def run(dry_run: bool = False) -> list[dict]:
    client, user_id = (None, None) if dry_run else get_authenticated_client()
    summary = []

    for content_type in CONTENT_TYPES:
        data = run_content_pipeline(content_type)

        if data is None:
            summary.append({"content_type": content_type, "status": "skipped", "title": None, "id": None})
            continue

        if dry_run:
            summary.append({"content_type": content_type, "status": "success", "title": data.get("title"), "id": None})
            continue

        insert_fn = _INSERTERS[content_type]
        content_id = insert_fn(client, data, user_id)
        summary.append({"content_type": content_type, "status": "success", "title": data.get("title"), "id": content_id})

    return summary


def _print_summary(summary: list[dict]) -> None:
    for entry in summary:
        icon = "✅" if entry["status"] == "success" else "⚠️"
        print(f"{icon} {entry['content_type']}: {entry['status']} — {entry['title'] or '(스킵됨)'}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    _print_summary(run(dry_run=args.dry_run))
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd scripts/crewai && pytest tests/test_main.py -v`
Expected: PASS (3 tests)

- [ ] **Step 5: Run the full test suite to confirm nothing else broke**

Run: `cd scripts/crewai && pytest -v`
Expected: PASS (all tests across every module)

- [ ] **Step 6: Commit**

```bash
git add scripts/crewai/main.py scripts/crewai/tests/test_main.py
git commit -m "feat: CrewAI 파이프라인 진입점(main.py, --dry-run 지원) 추가"
```

---

### Task 12: GitHub Actions 워크플로우 + README

**Files:**
- Create: `.github/workflows/crewai-agent.yml`
- Create: `scripts/crewai/README.md`

**Interfaces:** None — this is the deployment/documentation surface for everything built in Tasks 1-11. No new Python interfaces are introduced.

- [ ] **Step 1: Create the workflow file**

```yaml
# .github/workflows/crewai-agent.yml
name: QuizRank CrewAI Agent

on:
  schedule:
    - cron: "0 19 * * *"  # 매일 04:00 KST (UTC+9) = 전날 19:00 UTC. GAS 03:00 KST 실행과 겹치지 않음
  workflow_dispatch:
    inputs:
      dry_run:
        description: "true면 Supabase에 적재하지 않고 콘솔에만 출력"
        required: false
        default: "false"

jobs:
  run-agent:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: quiz-platform/scripts/crewai
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"

      - name: Install dependencies
        run: pip install -r requirements.txt

      - name: Run test suite
        run: pytest -v

      - name: Run CrewAI pipeline
        env:
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
          AGENT_EMAIL: ${{ secrets.AGENT_EMAIL }}
          AGENT_PASSWORD: ${{ secrets.AGENT_PASSWORD }}
        run: |
          if [ "${{ github.event.inputs.dry_run }}" = "true" ]; then
            python main.py --dry-run
          else
            python main.py
          fi
```

> Confirmed via `git rev-parse --show-toplevel`: the git repo root is `C:\Users\main\Desktop\Dev\products` (remote `weaseleyegun/product-builder-lecture`), and `quiz-platform/` is a subfolder within it alongside sibling project folders (`Djangun_excel/`, `youtube_character/`, `.agent/`). So `actions/checkout@v4` checks out the whole monorepo, and `working-directory: quiz-platform/scripts/crewai` above is correct as written.

- [ ] **Step 2: Validate the workflow YAML parses**

Run: `python -c "import yaml; yaml.safe_load(open('.github/workflows/crewai-agent.yml'))" ` (run from repo root, using the `PyYAML` dependency installed in Task 1)
Expected: no output, exit code 0

- [ ] **Step 3: Create `scripts/crewai/README.md`**

```markdown
# QuizRank CrewAI 콘텐츠 파이프라인

기획→작성→SEO→검수 4단계 CrewAI 멀티에이전트로 퀴즈/월드컵 콘텐츠를 생성해 Supabase에 적재합니다.
기존 GAS 에이전트(`scripts/gas/quizrank_agent.js`)와 병행 운영 중이며, 아직 이 파이프라인이 GAS를 대체하지 않습니다.

## 로컬 실행

\`\`\`bash
cd scripts/crewai
pip install -r requirements.txt
cp .env.example .env  # 값 채우기
python -m dotenv run -- python main.py --dry-run   # Supabase에 적재하지 않고 콘솔 출력만 확인
python -m dotenv run -- python main.py             # 실제 Supabase 적재
\`\`\`

## 테스트

\`\`\`bash
cd scripts/crewai
pytest -v
\`\`\`

## GitHub Actions

- 매일 04:00 KST 자동 실행 (`.github/workflows/crewai-agent.yml`)
- Actions 탭 → QuizRank CrewAI Agent → Run workflow 로 수동 실행 가능 (`dry_run: true`로 먼저 검증 권장)
- 필요한 Secrets: `GEMINI_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `AGENT_EMAIL`, `AGENT_PASSWORD`
```

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/crewai-agent.yml scripts/crewai/README.md
git commit -m "ci: CrewAI 파이프라인용 GitHub Actions 스케줄 워크플로우 및 README 추가"
```

---

## Manual Verification (after all tasks complete)

1. GitHub 저장소 Settings → Secrets에 `GEMINI_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `AGENT_EMAIL`, `AGENT_PASSWORD` 등록.
2. Actions 탭에서 `QuizRank CrewAI Agent` 워크플로우를 `dry_run: true`로 수동 실행 → 로그에서 퀴즈/월드컵 제목과 스킵 여부 확인.
3. `dry_run: false`로 1회 더 수동 실행 → Supabase `quizzes`/`quiz_questions`/`worldcups`/`worldcup_items` 테이블에 새 행이 생겼는지, GAS가 만든 기존 행과 스키마가 동일한지 확인.
4. 최소 1~2주간 GAS와 CrewAI 결과물을 나란히 비교 (설명 품질, SEO 메타, 문항 완성도) — 스펙에 명시된 롤아웃 전략에 따라 이후 GAS 트리거 해제 여부 결정.
