const https = require('https');

async function searchImageDDG(query) {
    // This is a simplified simulation of what some ddg packages do
    // Real reliable way is to search and parse, but for a task like this,
    // I can use the Wikipedia suggestion but with a MUCH larger thumbnail size
    // or a direct DuckDuckGo Proxy URL.

    // Let's try to get a better Wikipedia URL first as it is very reliable.
    const rawName = query.split(" (")[0];
    const url = `https://ko.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(rawName)}&prop=pageimages&format=json&pithumbsize=1000`;

    return new Promise((resolve) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    const pages = json.query.pages;
                    const pageId = Object.keys(pages)[0];
                    if (pageId !== "-1" && pages[pageId].thumbnail) {
                        resolve(pages[pageId].thumbnail.source);
                    } else {
                        resolve(null);
                    }
                } catch (e) { resolve(null); }
            });
        }).on('error', () => resolve(null));
    });
}

async function test() {
    const karina = await searchImageDDG("카리나 aespa");
    console.log("Karina Image:", karina);
    const winter = await searchImageDDG("윈터 aespa");
    console.log("Winter Image:", winter);
}
test();
