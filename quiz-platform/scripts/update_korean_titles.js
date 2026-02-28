import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.dev.vars') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

const titleMapping = {
    "Ado - Usseewa": "Ado - Usseewa (우세와)",
    "Ado - Odo": "Ado - Odo (춤)",
    "Ado - Gira Gira": "Ado - Gira Gira (기라기라)",
    "Ado - New Genesis": "Ado - New Genesis (신시대)",
    "Ado - I'm a Controversy": "Ado - I'm a Controversy (나는 문제작)",
    "Ado - Tot Musica": "Ado - Tot Musica (토트 무지카)",
    "Ado - Kura Kura": "Ado - Kura Kura (쿠라쿠라)",
    "Ado - Show": "Ado - Show (창)",
    "Ado - Backlight": "Ado - Backlight (역광)",
    "Ado - Fleeting Lullaby": "Ado - Fleeting Lullaby (물거품 룰라바이)",
    "yama - Haru wo Tsugeru": "yama - Haru wo Tsugeru (봄을 고하다)",
    "yama - Masshiro": "yama - Masshiro (새하얀)",
    "yama - a.m.3:21": "yama - a.m.3:21",
    "yama - Namae no Nai Kaibutsu": "yama - Namae no Nai Kaibutsu (이름 없는 괴물)",
    "yama - Oz.": "yama - Oz. (오즈)",
    "yama - color": "yama - color (컬러)",
    "yama - Shikisai": "yama - Shikisai (색채)",
    "natori - Overdose": "natori - Overdose (오버도즈)",
    "natori - Friday Night": "natori - Friday Night (프라이데이 나이트)",
    "natori - Saru Shibai": "natori - Saru Shibai (원숭이 연극)",
    "natori - Sleepwalk": "natori - Sleepwalk (슬립워크)",
    "natori - Eureka": "natori - Eureka (에우레카)",
    "Eve - Kaikai Kitan": "Eve - Kaikai Kitan (회회기담)",
    "Eve - Dramaturgy": "Eve - Dramaturgy (드라마투르기)",
    "Eve - As You Like It": "Eve - As You Like It (뜻대로 하세요)",
    "Eve - Nonsense Bungaku": "Eve - Nonsense Bungaku (넌센스 문학)",
    "Eve - Tokyo Ghetto": "Eve - Tokyo Ghetto (도쿄 게토)",
    "Eve - Ao no Waltz": "Eve - Ao no Waltz (푸른 왈츠)",
    "Eve - Yoru wa Honoka": "Eve - Yoru wa Honoka (밤은 아스라이)",
    "Eve - Shinkai": "Eve - Shinkai (심해)",
    "Eve - Fight Song": "Eve - Fight Song (파이트 송)",
    "Eve - Bokura Mada Underground": "Eve - Bokura Mada Underground (우리들은 아직 언더그라운드)",
    "YOASOBI - Yoru ni Kakeru": "YOASOBI - Yoru ni Kakeru (밤을 달리다)",
    "YOASOBI - Idol": "YOASOBI - Idol (아이돌)",
    "YOASOBI - Kaibutsu": "YOASOBI - Kaibutsu (괴물)",
    "YOASOBI - Gunjo": "YOASOBI - Gunjo (군청)",
    "YOASOBI - Tabun": "YOASOBI - Tabun (아마도)",
    "YOASOBI - Haruka": "YOASOBI - Haruka (하루카)",
    "YOASOBI - Shukufuku": "YOASOBI - Shukufuku (축복)",
    "YOASOBI - Yuusha": "YOASOBI - Yuusha (용사)",
    "YOASOBI - Biri-Biri": "YOASOBI - Biri-Biri (찌릿찌릿)",
    "Yorushika - Tada Kimi ni Hare": "Yorushika - Tada Kimi ni Hare (그저 네게 맑아라)",
    "Yorushika - Dakara Boku wa Ongaku wo Yameta": "Yorushika - Dakara Boku wa Ongaku wo Yameta (그래서 나는 음악을 그만두었다)",
    "Yorushika - Itte.": "Yorushika - Itte. (말해줘.)",
    "Yorushika - Hana ni Borei": "Yorushika - Hana ni Borei (꽃에 망령)",
    "Yorushika - Haru Dorobou": "Yorushika - Haru Dorobou (봄도둑)",
    "Yorushika - Elma": "Yorushika - Elma (엘마)",
    "Yorushika - Matasaburou": "Yorushika - Matasaburou (마타사부로)",
    "ZUTOMAYO - Byoushin wo Kamu": "ZUTOMAYO - Byoushin wo Kamu (초침을 깨물다)",
    "ZUTOMAYO - Nouriue no Cracker": "ZUTOMAYO - Nouriue no Cracker (뇌리상의 크래커)",
    "ZUTOMAYO - Humanoid": "ZUTOMAYO - Humanoid (휴머노이드)",
    "ZUTOMAYO - Obenkyou Shitoiteyo": "ZUTOMAYO - Obenkyou Shitoiteyo (공부해둬)",
    "ZUTOMAYO - Darken": "ZUTOMAYO - Darken (어둡게 검게)",
    "ZUTOMAYO - Kira Killer": "ZUTOMAYO - Kira Killer (키라 킬러)",
    "ZUTOMAYO - Time Left": "ZUTOMAYO - Time Left (잔기)",
    "Vaundy - Kaiju no Hanauta": "Vaundy - Kaiju no Hanauta (괴수의 꽃노래)",
    "Vaundy - Odoriko": "Vaundy - Odoriko (무희)",
    "Vaundy - napori": "Vaundy - napori (나포리)",
    "Vaundy - Tokyo Flash": "Vaundy - Tokyo Flash (도쿄 플래시)",
    "Vaundy - Fukakouryoku": "Vaundy - Fukakouryoku (불가항력)",
    "Vaundy - Hadaka no Yuusha": "Vaundy - Hadaka no Yuusha (벌거벗은 용사)",
    "Vaundy - Chainsaw Blood": "Vaundy - Chainsaw Blood (체인소 블러드)",
    "Kenshi Yonezu - Lemon": "Kenshi Yonezu - Lemon (레몬)",
    "Kenshi Yonezu - Kick Back": "Kenshi Yonezu - Kick Back (킥백)",
    "Kenshi Yonezu - Loser": "Kenshi Yonezu - Loser (루저)",
    "Kenshi Yonezu - Peace Sign": "Kenshi Yonezu - Peace Sign (피스 사인)",
    "Kenshi Yonezu - Eine Kleine": "Kenshi Yonezu - Eine Kleine (아이네 클라이네)",
    "Kenshi Yonezu - Flamingo": "Kenshi Yonezu - Flamingo (플라밍고)",
    "Kenshi Yonezu - M87": "Kenshi Yonezu - M87 (M팔십칠)",
    "Kenshi Yonezu - Lady": "Kenshi Yonezu - Lady (레이디)",
    "Kenshi Yonezu - Chikyuugi": "Kenshi Yonezu - Chikyuugi (지구본)",
    "imase - NIGHT DANCER": "imase - NIGHT DANCER (나이트 댄서)",
    "imase - Have a good day": "imase - Have a good day (해브 어 굿 데이)",
    "imase - Nagisa": "imase - Nagisa (나기사)",
    "imase - Heroine": "imase - Heroine (히로인)",
    "Fuji Kaze - Shinunoga E-Wa": "Fuji Kaze - Shinunoga E-Wa (죽는 게 나아)",
    "Fuji Kaze - Matsuri": "Fuji Kaze - Matsuri (마츠리)",
    "Fuji Kaze - Kirari": "Fuji Kaze - Kirari (키라리)",
    "Fuji Kaze - Grace": "Fuji Kaze - Grace (그레이스)",
    "Fuji Kaze - Michi Teyu Ku": "Fuji Kaze - Michi Teyu Ku (넘쳐흐르네)",
    "Yuuri - Dry Flower": "Yuuri - Dry Flower (드라이 플라워)",
    "Yuuri - Betelgeuse": "Yuuri - Betelgeuse (베텔기우스)",
    "Yuuri - Peter Pan": "Yuuri - Peter Pan (피터팬)",
    "Yuuri - Kakurenbo": "Yuuri - Kakurenbo (숨바꼭질)",
    "Yuuri - Leo": "Yuuri - Leo (레오)",
    "Aimer - Zankyou Sanka": "Aimer - Zankyou Sanka (잔향산가)",
    "Aimer - Kataomoi": "Aimer - Kataomoi (짝사랑)",
    "Aimer - Ref:rain": "Aimer - Ref:rain (리프레인)",
    "Aimer - Brave Shine": "Aimer - Brave Shine (브레이브 샤인)",
    "Aimer - I beg you": "Aimer - I beg you (아이 벡 유)",
    "Aimer - Spark-Again": "Aimer - Spark-Again (스파크 어게인)",
    "Eill - Koko de Iki wo Shite": "Eill - Koko de Iki wo Shite (여기서 숨을 쉬어)",
    "Eill - Fake Love": "Eill - Fake Love (페이크 러브)",
    "Kanaria - King": "Kanaria - King (킹)",
    "Kanaria - Envy Baby": "Kanaria - Envy Baby (엔비 베이비)",
    "Kanaria - Yoidore Shirazu": "Kanaria - Yoidore Shirazu (취기를 모름)",
    "Kanaria - Requiem": "Kanaria - Requiem (레퀴엠)"
};

async function main() {
    await supabase.auth.signInWithPassword({
        email: 'agent@quizrank.com',
        password: 'seed_password_1234!'
    });

    const { data: utaiteQuiz, error: fetchErr } = await supabase
        .from('quizzes')
        .select('id')
        .eq('title', '🎤 우타이테/얼굴없는 가수 명곡 선발')
        .single();

    if (fetchErr) {
        console.error("Quiz Fetch Error:", fetchErr);
        return;
    }

    const quizId = utaiteQuiz.id;

    const { data: questions, error: questionsErr } = await supabase
        .from('quiz_questions')
        .select('id, answer, options')
        .eq('quiz_id', quizId);

    if (questionsErr) {
        console.error("Questions Fetch Error:", questionsErr);
        return;
    }

    let updatedCount = 0;

    for (const q of questions) {
        let isChanged = false;

        let newAnswer = q.answer;
        if (titleMapping[q.answer]) {
            newAnswer = titleMapping[q.answer];
            isChanged = true;
        }

        let newOptions = q.options;
        if (typeof newOptions === 'string') {
            newOptions = JSON.parse(newOptions);
        }

        for (let opt of newOptions) {
            if (titleMapping[opt.text]) {
                opt.text = titleMapping[opt.text];
                isChanged = true;
            }
        }

        if (isChanged) {
            await supabase
                .from('quiz_questions')
                .update({ answer: newAnswer, options: newOptions })
                .eq('id', q.id);
            updatedCount++;
        }
    }

    console.log(`✅ Success! Updated ${updatedCount} questions with Korean titles.`);
}

main();
