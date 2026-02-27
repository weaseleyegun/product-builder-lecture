-- 1. 고전 게임 BGM 퀴즈 추가
WITH new_quiz AS (
  INSERT INTO quizzes (id, title, description, play_count)
  VALUES (
    uuid_generate_v4(),
    '🕹️ 어떤 게임의 브금(BGM)일까요?',
    '들으면 바로 아는 그 시절 고전게임 / 갓겜 브금 맞추기!',
    0
  )
  RETURNING id
)
INSERT INTO quiz_questions (quiz_id, video_id, start_time, end_time, answer, options)
VALUES
((SELECT id FROM new_quiz), 'lJ1tBv_lVUI', 12, 17, 'A', '[{"id":"A","text":"메이플스토리 (로그인 화면)","isCorrect":true},{"id":"B","text":"스타크래프트","isCorrect":false},{"id":"C","text":"바람의나라","isCorrect":false},{"id":"D","text":"카트라이더","isCorrect":false}]'::jsonb),
((SELECT id FROM new_quiz), 'iJ0EInp-Nbg', 0, 5, 'B', '[{"id":"A","text":"오버워치","isCorrect":false},{"id":"B","text":"스타크래프트 (테란 BGM)","isCorrect":true},{"id":"C","text":"포켓몬스터","isCorrect":false},{"id":"D","text":"마인크래프트","isCorrect":false}]'::jsonb),
((SELECT id FROM new_quiz), 'NTa6XbzcqZI', 2, 7, 'C', '[{"id":"A","text":"크레이지아케이드","isCorrect":false},{"id":"B","text":"마비노기","isCorrect":false},{"id":"C","text":"수퍼마리오 (오리지널 코인)","isCorrect":true},{"id":"D","text":"스타크래프트","isCorrect":false}]'::jsonb),
((SELECT id FROM new_quiz), 'sJ6sWl1nCww', 0, 5, 'D', '[{"id":"A","text":"메이플스토리","isCorrect":false},{"id":"B","text":"바람의나라","isCorrect":false},{"id":"C","text":"카트라이더","isCorrect":false},{"id":"D","text":"크레이지아케이드 (Bnb)","isCorrect":true}]'::jsonb),
((SELECT id FROM new_quiz), '_aRYO5J1qQY', 4, 9, 'A', '[{"id":"A","text":"포켓몬스터 (전투 BGM)","isCorrect":true},{"id":"B","text":"슈퍼마리오","isCorrect":false},{"id":"C","text":"오버워치","isCorrect":false},{"id":"D","text":"메이플스토리","isCorrect":false}]'::jsonb),
((SELECT id FROM new_quiz), '1rRSW95M1wY', 5, 10, 'B', '[{"id":"A","text":"카트라이더","isCorrect":false},{"id":"B","text":"카운터 스트라이크","isCorrect":true},{"id":"C","text":"바람의나라","isCorrect":false},{"id":"D","text":"스타크래프트","isCorrect":false}]'::jsonb),
((SELECT id FROM new_quiz), 'ZJd66mO-75U', 1, 6, 'C', '[{"id":"A","text":"포켓몬스터","isCorrect":false},{"id":"B","text":"크레이지아케이드","isCorrect":false},{"id":"C","text":"동물의 숲 (오전 8시)","isCorrect":true},{"id":"D","text":"마비노기","isCorrect":false}]'::jsonb),
((SELECT id FROM new_quiz), 'Mh9g1f-kS3Q', 2, 7, 'D', '[{"id":"A","text":"메이플스토리","isCorrect":false},{"id":"B","text":"스타크래프트","isCorrect":false},{"id":"C","text":"오버워치","isCorrect":false},{"id":"D","text":"젤다의 전설 (야숨 메인 테마)","isCorrect":true}]'::jsonb),
((SELECT id FROM new_quiz), '5mWMvry4bEw', 3, 8, 'A', '[{"id":"A","text":"바람의 나라 (타이틀)","isCorrect":true},{"id":"B","text":"마비노기","isCorrect":false},{"id":"C","text":"카트라이더","isCorrect":false},{"id":"D","text":"슈퍼마리오","isCorrect":false}]'::jsonb);

-- 2. 리그오브레전드(LoL) 대사 퀴즈 추가
WITH new_quiz AS (
  INSERT INTO quizzes (id, title, description, play_count)
  VALUES (
    uuid_generate_v4(),
    '🗡️ 롤(LoL) 캐릭터 대사 듣고 맞추기',
    '대사만 듣고 어떤 챔피언인지 맞혀보세요!',
    0
  )
  RETURNING id
)
INSERT INTO quiz_questions (quiz_id, video_id, start_time, end_time, answer, options)
VALUES
((SELECT id FROM new_quiz), '_-zRY_Yh3fI', 7, 10, 'A', '[{"id":"A","text":"야스오","isCorrect":true},{"id":"B","text":"다리우스","isCorrect":false},{"id":"C","text":"요네","isCorrect":false},{"id":"D","text":"가렌","isCorrect":false}]'::jsonb),
((SELECT id FROM new_quiz), 'gJv-_Fq6rN0', 3, 6, 'B', '[{"id":"A","text":"티모","isCorrect":false},{"id":"B","text":"가렌","isCorrect":true},{"id":"C","text":"이즈리얼","isCorrect":false},{"id":"D","text":"리신","isCorrect":false}]'::jsonb),
((SELECT id FROM new_quiz), 'B0nC_eD11aI', 2, 5, 'C', '[{"id":"A","text":"르블랑","isCorrect":false},{"id":"B","text":"블리츠크랭크","isCorrect":false},{"id":"C","text":"티모","isCorrect":true},{"id":"D","text":"진","isCorrect":false}]'::jsonb),
((SELECT id FROM new_quiz), 'XWn6q_v_0qY', 4, 8, 'D', '[{"id":"A","text":"아리","isCorrect":false},{"id":"B","text":"진","isCorrect":false},{"id":"C","text":"아칼리","isCorrect":false},{"id":"D","text":"징크스","isCorrect":true}]'::jsonb),
((SELECT id FROM new_quiz), 'WcQWY35ZqA0', 6, 10, 'A', '[{"id":"A","text":"진","isCorrect":true},{"id":"B","text":"요네","isCorrect":false},{"id":"C","text":"이즈리얼","isCorrect":false},{"id":"D","text":"다리우스","isCorrect":false}]'::jsonb),
((SELECT id FROM new_quiz), 'uH3mR2tXZgM', 1, 4, 'B', '[{"id":"A","text":"마스터 이","isCorrect":false},{"id":"B","text":"리신","isCorrect":true},{"id":"C","text":"야스오","isCorrect":false},{"id":"D","text":"가렌","isCorrect":false}]'::jsonb),
((SELECT id FROM new_quiz), 'V1Yp0nQ2DMc', 5, 8, 'C', '[{"id":"A","text":"징크스","isCorrect":false},{"id":"B","text":"르블랑","isCorrect":false},{"id":"C","text":"블리츠크랭크","isCorrect":true},{"id":"D","text":"티모","isCorrect":false}]'::jsonb);

-- 3. 싸이월드 눈물 감성 퀴즈 추가
WITH new_quiz AS (
  INSERT INTO quizzes (id, title, description, play_count)
  VALUES (
    uuid_generate_v4(),
    '🎧 그때 그 시절 싸이월드 BGM 맞추기',
    '도토리 5개로 마음을 전했던 추억의 명곡들!',
    0
  )
  RETURNING id
)
INSERT INTO quiz_questions (quiz_id, video_id, start_time, end_time, answer, options)
VALUES
((SELECT id FROM new_quiz), '_o8Z8uE_u-U', 65, 70, 'A', '[{"id":"A","text":"프리스타일 - Y","isCorrect":true},{"id":"B","text":"윤도현 - 사랑했나봐","isCorrect":false},{"id":"C","text":"SG워너비 - 죄와벌","isCorrect":false},{"id":"D","text":"버즈 - 가시","isCorrect":false}]'::jsonb),
((SELECT id FROM new_quiz), '0Y_q7O8rFp0', 60, 65, 'B', '[{"id":"A","text":"에픽하이 - Fly","isCorrect":false},{"id":"B","text":"버즈 - 가시","isCorrect":true},{"id":"C","text":"김종국 - 제자리걸음","isCorrect":false},{"id":"D","text":"이승기 - 내 여자라니까","isCorrect":false}]'::jsonb),
((SELECT id FROM new_quiz), 'GfJ8E8n-a-I', 55, 60, 'C', '[{"id":"A","text":"V.O.S - 눈을 보고 말해요","isCorrect":false},{"id":"B","text":"동방신기 - Hug","isCorrect":false},{"id":"C","text":"SG워너비 - 내사람","isCorrect":true},{"id":"D","text":"MC몽 - 너에게 쓰는 편지","isCorrect":false}]'::jsonb),
((SELECT id FROM new_quiz), 'sP6H3S1_J2E', 46, 51, 'D', '[{"id":"A","text":"윤도현 - 사랑했나봐","isCorrect":false},{"id":"B","text":"프리스타일 - Y","isCorrect":false},{"id":"C","text":"에픽하이 - Fly","isCorrect":false},{"id":"D","text":"김종국 - 사랑스러워","isCorrect":true}]'::jsonb),
((SELECT id FROM new_quiz), 'c4eK_mK__58', 70, 75, 'A', '[{"id":"A","text":"에픽하이 - 우산","isCorrect":true},{"id":"B","text":"버즈 - 남자를 몰라","isCorrect":false},{"id":"C","text":"SG워너비 - 죄와벌","isCorrect":false},{"id":"D","text":"이승기 - 내 여자라니까","isCorrect":false}]'::jsonb);
