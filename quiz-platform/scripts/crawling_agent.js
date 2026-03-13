import inquirer from 'inquirer';
import chalk from 'chalk';
import cliProgress from 'cli-progress';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs/promises';
import { createClient } from '@supabase/supabase-js';

import { generateQuizData, generateTitles } from './prompt_templates.js';
import { searchAndValidateYoutube } from './link_validator.js';

// Load env vars
dotenv.config({ path: path.resolve(process.cwd(), '.dev.vars') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

function makeOptions(correctAnswer, allAnswers) {
    const wrongs = allAnswers.filter(a => a !== correctAnswer).sort(() => Math.random() - 0.5).slice(0, 3);
    const all = [correctAnswer, ...wrongs].sort(() => Math.random() - 0.5);
    return all.map((text, i) => ({ id: ['A', 'B', 'C', 'D'][i], text, isCorrect: text === correctAnswer }));
}

async function main() {
    console.log(chalk.bold.cyan('\n🚀 데이터 크롤링 에이전트 시작 🚀\n'));

    // CLI 인자 처리
    const args = process.argv.slice(2);
    const autoConfirmPos = args.indexOf('--yes');
    const autoConfirm = autoConfirmPos !== -1;
    if (autoConfirm) args.splice(autoConfirmPos, 1);

    let topic = args[0];
    let example = args[1];
    let targetCount = parseInt(args[2], 10);

    // 인자가 없으면 Inquirer 프롬프트 띄우기 (기존방식 유지)
    if (!topic || !example || isNaN(targetCount)) {
        const answers = await inquirer.prompt([
            {
                type: 'input',
                name: 'topic',
                message: chalk.yellow('1. 수집할 데이터의 주제(프롬프트)를 입력하세요:'),
                default: '2000년대 싸이월드 BGM'
            },
            {
                type: 'input',
                name: 'example',
                message: chalk.yellow('2. 원하는 데이터의 대표 예시를 한 개 입력하세요:'),
                default: '에픽하이 - Love Love Love'
            },
            {
                type: 'number',
                name: 'targetCount',
                message: chalk.yellow('3. 최소 수집할 데이터 개수를 입력하세요 (예: 100):'),
                default: 10
            }
        ]);
        topic = answers.topic;
        example = answers.example;
        targetCount = answers.targetCount;
    }

    console.log(chalk.blue(`\n[1/5] OpenAI를 통해 '${topic}' 관련 데이터를 추론 및 수집합니다...`));

    let collectedData = [];
    let needed = targetCount;
    // Chunk requests as OpenAI might timeout or hit token limits
    while (needed > 0) {
        let fetchCount = needed > 20 ? 20 : needed;
        console.log(chalk.dim(`  ... ${fetchCount}개 데이터 요청 중 (현재 ${collectedData.length}/${targetCount})`));
        try {
            const chunk = await generateQuizData(topic, example, fetchCount);
            if (chunk && chunk.length > 0) {
                collectedData.push(...chunk);
                needed -= chunk.length;
            } else {
                console.log(chalk.red('데이터 생성 실패/데이터가 비어있습니다. 종료합니다.'));
                process.exit(1);
            }
        } catch (e) {
            console.error(chalk.red('\nOpenAI 요청 중 오류 발생! 재시도하거나 개수를 줄여보세요.'));
            process.exit(1);
        }
    }

    // Remove duplicates by answer
    collectedData = collectedData.filter((item, index, self) =>
        index === self.findIndex((t) => t.answer === item.answer)
    );

    console.log(chalk.green(`\n✅ 성공적으로 총 ${collectedData.length}개의 고유 항목을 수집했습니다.`));

    // 2. 유튜브 링크 유효성 검사
    console.log(chalk.blue(`\n[2/5] 수집된 ${collectedData.length}개 항목의 유튜브 링크 유효성을 검사합니다...`));
    const progressBar = new cliProgress.SingleBar({
        format: chalk.cyan('{bar}') + ' {percentage}% | ETA: {eta}s | {value}/{total} | {status}'
    }, cliProgress.Presets.shades_classic);

    progressBar.start(collectedData.length, 0, { status: '초기화 중...' });

    let validItems = [];
    for (let i = 0; i < collectedData.length; i++) {
        const item = collectedData[i];
        progressBar.update(i, { status: `검색 중: ${item.answer}` });

        const ytInfo = await searchAndValidateYoutube(item.searchQuery);
        if (ytInfo) {
            validItems.push({
                ...item,
                videoId: ytInfo.videoId,
                videoTitle: ytInfo.title
            });
        }

        // 간단한 딜레이 (Rate limit 방지)
        await new Promise(r => setTimeout(r, 500));
        progressBar.update(i + 1, { status: `완료: ${item.answer}` });
    }
    progressBar.stop();

    console.log(chalk.green(`\n✅ 유효성 검사 완료: ${validItems.length}/${collectedData.length} 개 생존`));

    if (validItems.length === 0) {
        console.log(chalk.red('\n추출된 유효한 동영상이 없어 종료합니다.'));
        process.exit(1);
    }

    // 3. 제목 추천
    console.log(chalk.blue(`\n[3/5] 데이터 기반 매력적인 퀴즈 제목을 추천받습니다...`));
    const suggestedTitles = await generateTitles(topic, validItems);

    let finalTitle = "";
    if (autoConfirm && suggestedTitles.length > 0) {
        finalTitle = suggestedTitles[0];
        console.log(chalk.yellow(`\n(자동 모드) 첫 번째 제목 자동 선택: ${finalTitle}`));
    } else {
        const titleAnswer = await inquirer.prompt([
            {
                type: 'list',
                name: 'selectedTitle',
                message: chalk.yellow('4. 사용할 퀴즈 제목을 선택하세요:'),
                choices: suggestedTitles
            }
        ]);
        finalTitle = titleAnswer.selectedTitle;
    }

    // 4. 리포트 생성 및 저장
    console.log(chalk.blue(`\n[4/5] 로컬에 output.json을 저장하고, 요약 리포트를 출력합니다...`));

    // distractors (선지) 만들기용 풀
    const allAnswers = validItems.map(v => v.answer);

    const finalPayload = validItems.map(v => ({
        video_id: v.videoId,
        start_time: 30, // 임의 기본값
        end_time: 45, // 임의 기본값
        answer: v.answer,
        hint: v.hint,
        options: makeOptions(v.answer, allAnswers),
        is_embeddable: true
    }));

    await fs.writeFile('output.json', JSON.stringify({ title: finalTitle, items: finalPayload }, null, 2));

    console.log(chalk.bgGray.white('\n--- 📊 수집 리포트 ---'));
    console.log(`선택된 제목: ${chalk.bold(finalTitle)}`);
    console.log(`유효한 항목: ${finalPayload.length}건`);
    console.log(`저장된 경로: ./output.json`);
    console.log('----------------------\n');

    // 5. DB Insert 여부 확인
    let proceedToDb = autoConfirm;
    if (!autoConfirm) {
        const confirmAnswer = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'proceedToDb',
                message: chalk.red.bold('5. 위 데이터를 실제 데이터베이스(Supabase)에 저장하시겠습니까?'),
                default: false
            }
        ]);
        proceedToDb = confirmAnswer.proceedToDb;
    }

    if (!proceedToDb) {
        console.log(chalk.yellow('\n사용자가 DB 저장을 취소했습니다. 로컬 파일(output.json)만 유지됩니다. 수고하셨습니다!'));
        process.exit(0);
    }

    console.log(chalk.blue(`\n[5/5] DB에 퀴즈 및 문제를 삽입합니다...`));

    // 로그인 (bulk_add_cyworld_lol.js 참고)
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: 'agent@quizrank.com',
        password: 'seed_password_1234!'
    });

    if (authError) {
        console.error(chalk.red('DB 권한(로그인) 실패:', authError.message));
        process.exit(1);
    }

    // 1. Quizzes 테이블에 삽입
    const { data: quizData, error: quizError } = await supabase.from('quizzes').insert([
        { title: finalTitle, description: topic, thumbnail_url: null }
    ]).select().single();

    if (quizError || !quizData) {
        console.error(chalk.red('퀴즈 생성 실패:', quizError?.message));
        process.exit(1);
    }

    const quizId = quizData.id;

    // 2. Quiz Questions 테이블에 일괄 삽입
    const dbPayload = finalPayload.map(p => ({
        quiz_id: quizId,
        video_id: p.video_id,
        start_time: p.start_time,
        end_time: p.end_time,
        answer: p.answer,
        options: p.options,
        is_embeddable: p.is_embeddable
    }));

    // BATCH insert
    for (let b = 0; b < dbPayload.length; b += 20) {
        const { error: insertError } = await supabase.from('quiz_questions').insert(dbPayload.slice(b, b + 20));
        if (insertError) {
            console.error(chalk.red(`문항 삽입 실패 (배치 ${b}~):`, insertError.message));
        }
    }

    console.log(chalk.green(`\n🎉 모든 작업이 완료되었습니다! 퀴즈 메인 화면에서 '${finalTitle}'을(를) 플레이 할 수 있어야 합니다.`));
    process.exit(0);
}

main();
