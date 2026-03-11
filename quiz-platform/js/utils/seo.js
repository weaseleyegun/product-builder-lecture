// js/utils/seo.js - Dynamic meta tag management for SEO

function updateSEOMeta(title, description, thumbnail) {
    if (!title) return;

    const fullTitle = title + ' - Quiz-Rank.com';
    const cleanDesc = description ? description.replace(/\[.*?\]/g, '').trim().substring(0, 160) : '재미있는 퀴즈와 이상형 월드컵을 QuizRank에서 즐겨보세요!';

    // 1. Update <title>
    document.title = fullTitle;

    // 2. Update Meta Description
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
        metaDesc = document.createElement('meta');
        metaDesc.name = 'description';
        document.head.appendChild(metaDesc);
    }
    metaDesc.content = cleanDesc;

    // 3. Update OG Tags
    const ogTags = {
        'og:title': fullTitle,
        'og:description': cleanDesc,
        'og:url': window.location.href,
        'og:type': 'website'
    };

    if (thumbnail) {
        ogTags['og:image'] = thumbnail;
    }

    for (let property in ogTags) {
        let tag = document.querySelector(`meta[property="${property}"]`);
        if (!tag) {
            tag = document.createElement('meta');
            tag.setAttribute('property', property);
            document.head.appendChild(tag);
        }
        tag.content = ogTags[property];
    }

    // 4. Update Twitter Tags
    const twitterTags = {
        'twitter:card': 'summary_large_image',
        'twitter:title': fullTitle,
        'twitter:description': cleanDesc
    };
    if (thumbnail) {
        twitterTags['twitter:image'] = thumbnail;
    }

    for (let name in twitterTags) {
        let tag = document.querySelector(`meta[name="${name}"]`);
        if (!tag) {
            tag = document.createElement('meta');
            tag.name = name;
            document.head.appendChild(tag);
        }
        tag.content = twitterTags[name];
    }
}

// Export for use in other scripts
if (typeof window !== 'undefined') {
    window.updateSEOMeta = updateSEOMeta;
}
