const fs = require('fs');
const files = fs.readdirSync('.').filter(f => f.endsWith('.html'));
const replacement = `            <div class="footer-links">
                <a href="terms.html">이용약관</a>
                <a href="privacy.html">개인정보처리방침</a>
                <a href="ad-inquiry.html">광고 문의</a>
            </div>`;

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    if (content.includes('<div class="footer-links">')) {
        content = content.replace(/<div class="footer-links">[\s\S]*?<\/div>/, replacement);
        fs.writeFileSync(file, content);
        console.log('Updated ' + file);
    }
});
