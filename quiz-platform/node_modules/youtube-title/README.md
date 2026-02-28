# youtube-title
Retrieve video title using video id and YouTube API

Installing via NPM
```
$ npm install youtube-title
```

Example
```
const youtubeTitle = require('youtube-title');

//result will be a string
let title = await youtubeTitle(videoId, apiKey);
```