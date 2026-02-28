const axios = require('axios');
const apiUrl = 'https://www.googleapis.com/youtube/v3';

module.exports = async function getTitle(videoId, apiKey) {
  try {
    const response = await axios.get(
      apiUrl + '/videos?part=snippet&id=' + videoId + '&key=' + apiKey
    );
    console.log(response.data.items[0].snippet.title);
    return response.data.items[0].snippet.title;
  } catch (error) {
    console.error(error);
  }
}