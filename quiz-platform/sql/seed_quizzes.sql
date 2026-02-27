-- 1단계: RLS 일시 해제 (선택사항, 혹은 그냥 Dashboard에서 직접 실행 시 기본적으로 최고 권한으로 진행되므로 안해도 됩니다)

-- 2단계: 오늘의 J-POP 100 퀴즈 데이터 삽입 (ID=1)
WITH new_quiz AS (
  INSERT INTO quizzes (id, title, description, play_count)
  VALUES (
    uuid_generate_v4(),
    '오늘의 J-POP 100',
    'YouTube 구간 노래 맞추기',
    0
  )
  RETURNING id
)
INSERT INTO quiz_questions (quiz_id, video_id, start_time, end_time, answer, options)
SELECT 
  new_quiz.id,
  unnest(ARRAY['ZRtdQ81jPUQ', 'M2cckDmQn3Q', '0xWi8j2VD-I']),
  unnest(ARRAY[61, 61, 71]),
  unnest(ARRAY[66, 66, 76]),
  unnest(ARRAY['B', 'B', 'A']),
  unnest(ARRAY[
    '[{"id":"A","text":"요아소비 - 밤을 달리다","isCorrect":false},{"id":"B","text":"요아소비 - 아이돌","isCorrect":true},{"id":"C","text":"아이묭 - 마리골드","isCorrect":false},{"id":"D","text":"요네즈 켄시 - 킥백","isCorrect":false}]',
    '[{"id":"A","text":"Lemon","isCorrect":false},{"id":"B","text":"KICK BACK","isCorrect":true},{"id":"C","text":"피스 사인","isCorrect":false},{"id":"D","text":"Loser","isCorrect":false}]',
    '[{"id":"A","text":"아이묭 - 메리골드","isCorrect":true},{"id":"B","text":"유우리 - 베텔기우스","isCorrect":false},{"id":"C","text":"바운디 - 괴수의 꽃노래","isCorrect":false},{"id":"D","text":"이마세 - 나이트 댄서","isCorrect":false}]'
  ]::jsonb[])
FROM new_quiz;

-- 3단계: 빌보드 핫 100 퀴즈 (ID=2)
WITH new_quiz AS (
  INSERT INTO quizzes (id, title, description, play_count)
  VALUES (
    uuid_generate_v4(),
    '빌보드 핫 100 퀴즈',
    '1초 듣고 맞추기 챌린지',
    0
  )
  RETURNING id
)
INSERT INTO quiz_questions (quiz_id, video_id, start_time, end_time, answer, options)
SELECT 
  new_quiz.id,
  unnest(ARRAY['kTJczUoc26U', 'nfs8NYg7yQM', 'JGwWNGJdvx8']),
  unnest(ARRAY[47, 0, 53]),
  unnest(ARRAY[52, 5, 58]),
  unnest(ARRAY['C', 'B', 'D']),
  unnest(ARRAY[
    '[{"id":"A","text":"Peaches","isCorrect":false},{"id":"B","text":"Ghost","isCorrect":false},{"id":"C","text":"STAY","isCorrect":true},{"id":"D","text":"Baby","isCorrect":false}]',
    '[{"id":"A","text":"We Don''t Talk Anymore","isCorrect":false},{"id":"B","text":"Attention","isCorrect":true},{"id":"C","text":"See You Again","isCorrect":false},{"id":"D","text":"Dangerously","isCorrect":false}]',
    '[{"id":"A","text":"Perfect","isCorrect":false},{"id":"B","text":"Thinking Out Loud","isCorrect":false},{"id":"C","text":"Photograph","isCorrect":false},{"id":"D","text":"Shape of You","isCorrect":true}]'
  ]::jsonb[])
FROM new_quiz;

-- 4단계: 애니메이션 OST 퀴즈 (ID=3)
WITH new_quiz AS (
  INSERT INTO quizzes (id, title, description, play_count)
  VALUES (
    uuid_generate_v4(),
    '애니메이션 OST 퀴즈',
    '애니메이션 노래 맞추기',
    0
  )
  RETURNING id
)
INSERT INTO quiz_questions (quiz_id, video_id, start_time, end_time, answer, options)
SELECT 
  new_quiz.id,
  unnest(ARRAY['CbH2F0kXCEU', 'CwkzK-F0Y00', 'a2GujJZfXpg']),
  unnest(ARRAY[56, 62, 265]),
  unnest(ARRAY[61, 67, 270]),
  unnest(ARRAY['C', 'B', 'C']),
  unnest(ARRAY[
    '[{"id":"A","text":"Cry Baby","isCorrect":false},{"id":"B","text":"Pretender","isCorrect":false},{"id":"C","text":"혼합 땅콩 (Mixed Nuts)","isCorrect":true},{"id":"D","text":"숙명","isCorrect":false}]',
    '[{"id":"A","text":"불꽃 (Homura)","isCorrect":false},{"id":"B","text":"홍련화 (Gurenge)","isCorrect":true},{"id":"C","text":"잔향산가","isCorrect":false},{"id":"D","text":"새벽녘","isCorrect":false}]',
    '[{"id":"A","text":"전전전세 (Zenzenzense)","isCorrect":false},{"id":"B","text":"아무것도 아니야 (Nandemonaiya)","isCorrect":false},{"id":"C","text":"스파클 (Sparkle)","isCorrect":true},{"id":"D","text":"꿈의 등불","isCorrect":false}]'
  ]::jsonb[])
FROM new_quiz;
