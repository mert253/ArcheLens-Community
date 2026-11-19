import { describe, expect, it } from 'vitest';
import { cursorPayloadSchema, drawPayloadSchemas, parseAnnotationRow, storedAnalysisSchema } from './validation';
const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
describe('untrusted collaboration data', () => {
  it('rejects malformed names, coordinates, colors, widths and points', () => {
    const cursor = { userId, name: 'Peer', color: '#abcdef', cursorX: 0.5, cursorY: 0.5 };
    expect(cursorPayloadSchema.safeParse(cursor).success).toBe(true);
    for (const update of [{ name: {} }, { name: 'x'.repeat(81) }, { cursorX: Infinity }, { cursorY: -1 }, { color: 'url(https://example.test)' }])
      expect(cursorPayloadSchema.safeParse({ ...cursor, ...update }).success).toBe(false);
    expect(drawPayloadSchemas.draw_start.safeParse({ userId, color: '#abcdef', width: NaN, point: { x: 0, y: 0 } }).success).toBe(false);
    expect(drawPayloadSchemas.draw_point.safeParse({ userId, point: null }).success).toBe(false);
    expect(drawPayloadSchemas.draw_end.safeParse({ userId, color: '#abcdef', width: 3, path: Array.from({ length: 1025 }, () => ({ x: 0, y: 0 })) }).success).toBe(false);
  });
  it('rejects malformed persisted annotations and analyses', () => {
    expect(parseAnnotationRow({ id: userId, user_id: userId, user_name: 123, type: 'draw', data: { points: [null] } })).toBeNull();
    expect(storedAnalysisSchema.safeParse({ title: {}, dating: null, analysis: [] }).success).toBe(false);
  });
});
