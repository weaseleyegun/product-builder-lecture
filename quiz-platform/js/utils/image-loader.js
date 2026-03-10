/**
 * Image Loader Utility
 * Handles robust image loading with fallbacks and proxy management.
 */

const ImageLoader = {
    // Default high-quality placeholder (using a generic avatar that looks premium)
    DEFAULT_PLACEHOLDER: 'https://ui-avatars.com/api/?name=Loading&background=333&color=fff&size=512',

    /**
     * Loads an image into an element with fallback logic.
     * @param {HTMLImageElement} imgEl - The image element to load into.
     * @param {string} primaryUrl - The URL from the database.
     * @param {string} name - The name of the item (for placeholder/alt).
     */
    load(imgEl, primaryUrl, name) {
        if (!imgEl) return;

        // Reset element state to prevent 'image shift' bug
        imgEl.src = this.DEFAULT_PLACEHOLDER;
        imgEl.style.opacity = '0.3';
        imgEl.style.transition = 'opacity 0.2s ease';

        const handleSuccess = () => {
            imgEl.style.opacity = '1';
        };

        const handleFallback = () => {
            console.warn(`Image failed to load: ${primaryUrl}. Trying fallback...`);

            // If the URL was already proxied, maybe the proxy is down or the original is gone.
            // Let's try to extract the original URL and try a different proxy or direct if possible.
            if (primaryUrl.includes('images.weserv.nl')) {
                try {
                    const originalUrl = new URL(primaryUrl).searchParams.get('url');
                    if (originalUrl) {
                        // Try direct as fallback
                        imgEl.src = (originalUrl.startsWith('http') ? '' : 'https://') + originalUrl;
                        imgEl.onerror = () => {
                            this.showPlaceholder(imgEl, name);
                        };
                        return;
                    }
                } catch (e) { }
            }

            this.showPlaceholder(imgEl, name);
        };

        imgEl.onload = handleSuccess;
        imgEl.onerror = handleFallback;
        imgEl.src = primaryUrl || this.getPlaceholderUrl(name);
    },

    showPlaceholder(imgEl, name) {
        imgEl.src = this.getPlaceholderUrl(name);
        imgEl.style.opacity = '1';
        imgEl.onerror = null; // Prevent infinite loops
    },

    getPlaceholderUrl(name) {
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'Item')}&background=6366f1&color=fff&size=512&font-size=0.33&bold=true`;
    }
};

window.SafeImageLoader = ImageLoader;
