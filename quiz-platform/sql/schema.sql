-- 1. 사용자 프로필 테이블 (auth.users 와 연결)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  points INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 사용자 프로필 RLS (Row Level Security) 설정
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 누구나 프로필 조회 가능
CREATE POLICY "Public profiles are viewable by everyone." 
  ON profiles FOR SELECT USING (true);

-- 본인만 프로필 수정 가능
CREATE POLICY "Users can update own profile." 
  ON profiles FOR UPDATE USING (auth.uid() = id);

-- 2. 퀴즈 본체 테이블
CREATE TABLE quizzes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  creator_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  play_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Quizzes are viewable by everyone." ON quizzes FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create quizzes." ON quizzes FOR INSERT WITH CHECK (auth.uid() = creator_id);

-- 3. 퀴즈 문제 (유튜브 구간 등) 테이블
CREATE TABLE quiz_questions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE,
  video_id TEXT NOT NULL, -- YouTube Video ID
  start_time INTEGER DEFAULT 0,
  end_time INTEGER,
  answer TEXT NOT NULL,
  options JSONB, -- 객관식일 경우 보기 배열 저장
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Quiz questions viewable by everyone." ON quiz_questions FOR SELECT USING (true);

-- 4. 이상형 월드컵 (Worldcup) 테이블
CREATE TABLE worldcups (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  creator_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  play_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE worldcups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Worldcups viewable by everyone." ON worldcups FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create worldcups." ON worldcups FOR INSERT WITH CHECK (auth.uid() = creator_id);

-- 5. 월드컵 후보 아이템 테이블
CREATE TABLE worldcup_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  worldcup_id UUID REFERENCES worldcups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  image_url TEXT,
  win_count INTEGER DEFAULT 0, -- 최종 우승 횟수
  match_count INTEGER DEFAULT 0, -- 매치업 등장 횟수
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE worldcup_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Worldcup items viewable by everyone." ON worldcup_items FOR SELECT USING (true);
-- 게임 결과를 통해 누구나 카운트를 업데이트할 수 있도록 허용 (또는 엣지 함수/백엔드에서만 처리하도록 제한 가능)
CREATE POLICY "Anyone can update win/match counts" ON worldcup_items FOR UPDATE USING (true);

-- 6. Trigger: 새로운 구글/OAuth 회원가입 시 자동으로 Profiles 생성
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'user_name', NEW.raw_user_meta_data->>'full_name', 'User_' || substr(NEW.id::text, 1, 6)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();