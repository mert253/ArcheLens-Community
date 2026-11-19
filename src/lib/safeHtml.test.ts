import { describe, expect, it } from 'vitest';
import { escapeHtml, safeImageSource } from './safeHtml';

describe('untrusted report and map content', () => {
  it('escapes text and attribute delimiters from shared artifacts', () => {
    expect(escapeHtml('<img src=x onerror="alert(1)"> & \'')).toBe('&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; &#39;');
  });
  it('only permits raster data images and local blob URLs in printable reports', () => {
    expect(safeImageSource('javascript:alert(1)')).toBe('');
    expect(safeImageSource('data:image/svg+xml,<svg onload=alert(1)>')).toBe('');
    expect(safeImageSource('" onerror="alert(1)')).toBe('');
    expect(safeImageSource('data:image/png;base64,iVBORw0KGgo=')).toBe('data:image/png;base64,iVBORw0KGgo=');
  });
});
