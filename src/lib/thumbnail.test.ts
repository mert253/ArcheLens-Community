import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createThumbnail } from './thumbnail';

describe('createThumbnail', () => {
    let originalImage: typeof Image;
    let originalCreateElement: typeof document.createElement;
    let mockContext2D: any;
    let mockCanvas: any;

    beforeEach(() => {
        originalImage = window.Image;
        originalCreateElement = document.createElement.bind(document);

        mockContext2D = {
            drawImage: vi.fn(),
        };

        mockCanvas = {
            width: 0,
            height: 0,
            getContext: vi.fn((contextId: string) => {
                if (contextId === '2d') {
                    return mockContext2D;
                }
                return null;
            }),
            toDataURL: vi.fn((type, quality) => `data:${type};base64,mockdata`),
        };

        vi.stubGlobal('document', {
            ...document,
            createElement: vi.fn((tagName: string) => {
                if (tagName === 'canvas') {
                    return mockCanvas;
                }
                return originalCreateElement(tagName);
            }),
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('should scale down maintaining aspect ratio when width > height', async () => {
        vi.stubGlobal('Image', class {
            onload: () => void = () => {};
            onerror: () => void = () => {};
            src: string = '';
            width: number = 400;
            height: number = 200;

            constructor() {
                setTimeout(() => this.onload(), 0);
            }
        });

        const result = await createThumbnail('mockSrc', 200);

        expect(mockCanvas.width).toBe(200);
        expect(mockCanvas.height).toBe(100);
        expect(mockContext2D.drawImage).toHaveBeenCalledWith(expect.any(Object), 0, 0, 200, 100);
        expect(result).toBe('data:image/jpeg;base64,mockdata');
    });

    it('should scale down maintaining aspect ratio when height > width', async () => {
        vi.stubGlobal('Image', class {
            onload: () => void = () => {};
            onerror: () => void = () => {};
            src: string = '';
            width: number = 200;
            height: number = 400;

            constructor() {
                setTimeout(() => this.onload(), 0);
            }
        });

        const result = await createThumbnail('mockSrc', 200);

        expect(mockCanvas.width).toBe(100);
        expect(mockCanvas.height).toBe(200);
        expect(mockContext2D.drawImage).toHaveBeenCalledWith(expect.any(Object), 0, 0, 100, 200);
        expect(result).toBe('data:image/jpeg;base64,mockdata');
    });

    it('should not scale down when image dimensions are smaller than maxSize', async () => {
        vi.stubGlobal('Image', class {
            onload: () => void = () => {};
            onerror: () => void = () => {};
            src: string = '';
            width: number = 100;
            height: number = 150;

            constructor() {
                setTimeout(() => this.onload(), 0);
            }
        });

        const result = await createThumbnail('mockSrc', 200);

        expect(mockCanvas.width).toBe(100);
        expect(mockCanvas.height).toBe(150);
        expect(mockContext2D.drawImage).toHaveBeenCalledWith(expect.any(Object), 0, 0, 100, 150);
        expect(result).toBe('data:image/jpeg;base64,mockdata');
    });

    it('should reject on image error', async () => {
        vi.stubGlobal('Image', class {
            onload: () => void = () => {};
            onerror: () => void = () => {};
            src: string = '';

            constructor() {
                setTimeout(() => this.onerror(), 0);
            }
        });

        await expect(createThumbnail('mockSrc')).rejects.toThrow('Failed to load image for thumbnail');
    });

    it('should reject if canvas context is unavailable', async () => {
        mockCanvas.getContext = vi.fn().mockReturnValue(null);

        vi.stubGlobal('Image', class {
            onload: () => void = () => {};
            onerror: () => void = () => {};
            src: string = '';
            width: number = 100;
            height: number = 100;

            constructor() {
                setTimeout(() => this.onload(), 0);
            }
        });

        await expect(createThumbnail('mockSrc')).rejects.toThrow('Canvas context unavailable');
    });
});
