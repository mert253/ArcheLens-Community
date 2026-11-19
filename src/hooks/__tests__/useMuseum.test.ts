import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMuseum } from '../useMuseum';
import { supabase } from '../../lib/supabase';

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('useMuseum', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('successfully creates a museum (happy path)', async () => {
    const mockData = {
      id: '123',
      owner_id: 'user1',
      name: 'Test Museum',
      description: 'A test museum',
      is_public: false,
      created_at: '2023-01-01T00:00:00Z',
    };

    const selectMock = vi.fn().mockReturnThis();
    const singleMock = vi.fn().mockResolvedValue({ data: mockData, error: null });
    const insertMock = vi.fn().mockReturnValue({ select: selectMock, single: singleMock });

    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
      insert: insertMock,
    });

    const { result } = renderHook(() => useMuseum());

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();

    let createdMuseum;
    await act(async () => {
      createdMuseum = await result.current.createMuseum('user1', 'Test Museum', 'A test museum');
    });

    expect(supabase.from).toHaveBeenCalledWith('museums');
    expect(insertMock).toHaveBeenCalledWith({
      owner_id: 'user1',
      name: 'Test Museum',
      description: 'A test museum',
    });

    expect(createdMuseum).toEqual({
      id: '123',
      ownerId: 'user1',
      name: 'Test Museum',
      description: 'A test museum',
      isPublic: false,
      createdAt: '2023-01-01T00:00:00Z',
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('handles errors properly when creating a museum (error path)', async () => {
    const errorMessage = 'Network error';

    const selectMock = vi.fn().mockReturnThis();
    const singleMock = vi.fn().mockResolvedValue({ data: null, error: new Error(errorMessage) });
    const insertMock = vi.fn().mockReturnValue({ select: selectMock, single: singleMock });

    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
      insert: insertMock,
    });

    const { result } = renderHook(() => useMuseum());

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();

    let createdMuseum;
    await act(async () => {
      createdMuseum = await result.current.createMuseum('user1', 'Test Museum', 'A test museum');
    });

    expect(supabase.from).toHaveBeenCalledWith('museums');

    // The wrap function catches the error, sets the error state, and returns null
    expect(result.current.error).toBe(errorMessage);
    expect(result.current.loading).toBe(false); // loading should be false in the finally block
    expect(createdMuseum).toBeNull();
  });
});
