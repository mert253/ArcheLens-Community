import { describe, expect, it } from 'vitest';
import { normalizeStoredMuseumImage } from './museumImage';

const dataUrl = (mime: string, bytes: Uint8Array): string =>
  `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`;
const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);
const jpeg = Uint8Array.from([255, 216, 255, 224, 0]);
const webp = Buffer.from('RIFF....WEBP', 'ascii');

describe('normalizeStoredMuseumImage', () => {
  it('accepts safe small PNG, JPEG and WebP data URLs', () => {
    for (const value of [dataUrl('image/png', png), dataUrl('image/jpeg', jpeg), dataUrl('image/webp', webp)]) {
      expect(normalizeStoredMuseumImage(value)).toBe(value);
    }
  });
  it('returns null for missing or invalid values', () => {
    for (const value of [undefined, null, '', 'javascript:alert(1)', 'blob:http://localhost:3000/id', 'https://tracker.invalid/pixel.png', '<img src=x>']) {
      expect(normalizeStoredMuseumImage(value)).toBeNull();
    }
  });
  it('rejects SVG, MIME spoofing and malformed Base64', () => {
    expect(normalizeStoredMuseumImage(dataUrl('image/svg+xml', Buffer.from('<svg/>')))).toBeNull();
    expect(normalizeStoredMuseumImage(dataUrl('image/png', jpeg))).toBeNull();
    expect(normalizeStoredMuseumImage('data:image/png;base64,iVBORw0KGgo=malformed')).toBeNull();
    expect(normalizeStoredMuseumImage('data:image/jpeg;base64,/9j/+++')).toBeNull();
    expect(normalizeStoredMuseumImage('data:image/webp;base64,UklGR')).toBeNull();
  });
  it('rejects images exceeding 2 MiB after decoding', () => {
    const oversized = Buffer.alloc(2 * 1024 * 1024 + 1);
    oversized.set(png, 0);
    expect(normalizeStoredMuseumImage(dataUrl('image/png', oversized))).toBeNull();
  });
});
