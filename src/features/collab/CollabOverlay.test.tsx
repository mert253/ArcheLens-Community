import React from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CollabOverlay } from './CollabOverlay';
const mock = vi.hoisted(() => ({ options: null as any, load: vi.fn().mockResolvedValue([]) }));
vi.mock('../../hooks/useCollaboration', () => ({ pickColor: () => '#abcdef', useCollaboration: (options: unknown) => {
  mock.options = options;
  return { connected: true, presenceUsers: [{ userId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', name: {}, color: '#abcdef', cursorX: 0, cursorY: 0 }], loadAnnotations: mock.load, broadcastCursor: vi.fn(), broadcastDrawStart: vi.fn(), broadcastDrawPoint: vi.fn(), broadcastDrawEnd: vi.fn(), saveAnnotation: vi.fn(), deleteAnnotation: vi.fn() };
} }));
const context = { clearRect: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn() };
beforeEach(() => { vi.clearAllMocks(); vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as any); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it('ignores malformed peer display data and caps canvas work under stroke floods', async () => {
  render(<CollabOverlay analysisId="11111111-1111-4111-8111-111111111111" userId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" userName={{} as any} lang="en" />);
  expect(screen.getByText('Participant')).toBeInTheDocument();
  const userId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  await act(async () => {
    mock.options.onDrawEvent({ type: 'draw_end', userId, color: '#abcdef', width: 3, path: [null, null] });
    for (let i = 0; i < 200; i++) mock.options.onDrawEvent({ type: 'draw_end', userId, color: '#abcdef', width: 3, path: [{ x: 0, y: 0 }, { x: 1, y: 1 }] });
  });
  await waitFor(() => expect(context.moveTo).toHaveBeenCalled());
  expect(context.moveTo.mock.calls.length).toBeLessThanOrEqual(64);
});
