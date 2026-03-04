import ytsr from 'ytsr';

/**
 * 주어진 검색어를 유튜브에 검색하여 첫 번째 유효한 동영상의 정보를 반환합니다.
 * @param {string} query - 검색어 (예: "에픽하이 Love Love Love 명장면")
 * @returns {Promise<Object|null>} - { videoId, title, duration } 또는 null
 */
export async function searchAndValidateYoutube(query) {
    try {
        // 첫 번째 검색 결과 모음을 가져옵니다.
        const filters1 = await ytsr.getFilters(query);
        const filter1 = filters1.get('Type').get('Video');
        if (!filter1.url) {
            return null;
        }

        const options = {
            limit: 5, // 첫 5개 중에서 가져옵니다.
        };
        const searchResults = await ytsr(filter1.url, options);

        // 결과 중에서 실제 동영상 항목인 것 중 첫 번째를 가져옵니다.
        const video = searchResults.items.find(item => item.type === 'video');

        if (video) {
            return {
                videoId: video.id,
                title: video.title,
                duration: video.duration,
                thumbnail: video.bestThumbnail ? video.bestThumbnail.url : null
            };
        }

        return null; // 검색 결과 없음
    } catch (error) {
        // 검색 실패나 네트워크 오류 시 null을 반환하여 유효하지 않음으로 처리
        console.error(`Youtube 검색 에러 ("${query}"):`, error.message);
        return null;
    }
}
