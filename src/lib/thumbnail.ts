/**
 * Utility: creates a thumbnail from an image data URL.
 * Returns a small (200x200) data URL suitable for IndexedDB storage.
 */
export function createThumbnail(imageDataUrl: string, maxSize = 200): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let { width, height } = img;

            // Scale down maintaining aspect ratio
            if (width > height) {
                if (width > maxSize) {
                    height = Math.round((height * maxSize) / width);
                    width = maxSize;
                }
            } else {
                if (height > maxSize) {
                    width = Math.round((width * maxSize) / height);
                    height = maxSize;
                }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) { reject(new Error('Canvas context unavailable')); return; }

            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.7)); // ~10-30KB
        };
        img.onerror = () => reject(new Error('Failed to load image for thumbnail'));
        img.src = imageDataUrl;
    });
}
