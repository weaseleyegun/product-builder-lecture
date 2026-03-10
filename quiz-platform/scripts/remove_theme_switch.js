const fs = require('fs');

const files = fs.readdirSync('.').filter(f => f.endsWith('.html'));

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');

    // Match the entire theme-switch-wrapper block precisely
    const regex = /<div class="theme-switch-wrapper">[\s\S]*?<\/label>\s*<span class="theme-icon">[\s\S]*?<\/svg><\/span>\s*<\/div>/g;
    content = content.replace(regex, '');

    fs.writeFileSync(file, content);
});

console.log('Removed theme switch from HTML files.');
