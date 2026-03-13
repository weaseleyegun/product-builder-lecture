const fs = require('fs');
const path = require('path');

const baseDir = path.join(__dirname, '..');
const cssPath = path.join(baseDir, 'style.css');
let css = fs.readFileSync(cssPath, 'utf8');

const navLinksCss = `
.nav-links a {
    text-decoration: none;
    color: var(--text-color);
    margin: 0 1rem;
    font-weight: 600;
    transition: color var(--transition);
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
}

.nav-links a .nav-icon {
    width: 2rem;
    height: 2rem;
    border-radius: 0.6rem;
}

.nav-links a .nav-icon svg {
    width: 1.2rem;
    height: 1.2rem;
}`;

css = css.replace(
    /\.nav-links a \{[\s\S]*?transition: color var\(--transition\);\s*\}/,
    navLinksCss.trim()
);

fs.writeFileSync(cssPath, css);
console.log('style.css updated');

const quizSvgs = {
    quiz: `<span class="section-icon icon-quiz nav-icon"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg></span>`,
    worldcup: `<span class="section-icon icon-worldcup nav-icon"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path><path d="M4 22h16"></path><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path></svg></span>`,
    tier: `<span class="section-icon icon-tier nav-icon"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7.21 15 2.66 7.14a2 2 0 0 1 .13-2.2L4.4 2.8A2 2 0 0 1 6 2h12a2 2 0 0 1 1.6.8l1.6 2.14a2 2 0 0 1 .14 2.2L16.79 15"></path><path d="M11 12 5.12 2.2"></path><path d="m13 12 5.88-9.8"></path><path d="M8 7h8"></path><circle cx="12" cy="17" r="5"></circle><path d="M12 18v-2h-.5"></path></svg></span>`
};

const htmlFiles = fs.readdirSync(baseDir).filter(f => f.endsWith('.html'));
let modifiedCount = 0;

for (const file of htmlFiles) {
    const filePath = path.join(baseDir, file);
    let html = fs.readFileSync(filePath, 'utf8');

    // Remove the emojis and replace with SVGs
    // For Quiz: "🎵 오늘의 퀴즈" or "🎵 퀴즈 목록"
    // For Worldcup: "🏆 이상형 월드컵" or "🏆 월드컵 목록"
    // For Tier: "🏅 티어 리스트"

    let original = html;

    html = html.replace(
        /(<a href="quiz-list\.html">)\s*🎵\s*(오늘의 퀴즈|퀴즈 목록)(<\/a>)/g,
        `$1${quizSvgs.quiz} $2$3`
    );

    html = html.replace(
        /(<a href="worldcup-list\.html">)\s*🏆\s*(이상형 월드컵|월드컵 목록)(<\/a>)/g,
        `$1${quizSvgs.worldcup} $2$3`
    );

    html = html.replace(
        /(<a href="tier-list\.html">)\s*🏅\s*(티어 리스트)(<\/a>)/g,
        `$1${quizSvgs.tier} $2$3`
    );

    if (original !== html) {
        fs.writeFileSync(filePath, html);
        console.log(`Updated ${file}`);
        modifiedCount++;
    }
}
console.log(`Replaced in ${modifiedCount} HTML files.`);
