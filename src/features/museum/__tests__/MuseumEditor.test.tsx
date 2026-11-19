import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MuseumEditor } from '../MuseumEditor';
import { MuseumApp } from '../MuseumApp';

const mocks = vi.hoisted(() => ({
  museum: {} as any,
  auth: { user: { id: 'owner' } as { id: string } | null, authLoading: false },
}));
vi.mock('../../../hooks/useMuseum', () => ({ useMuseum: () => mocks.museum }));
vi.mock('../../../hooks/useHistory', () => ({ useHistory: () => ({ entries: [] }) }));
vi.mock('../../../store/useAppStore', () => ({ useAppStore: (select?: (state: typeof mocks.auth) => unknown) => select ? select(mocks.auth) : mocks.auth }));
vi.mock('../../../store/useUIStore', () => ({ useUIStore: () => ({ appMode: 'museum-edit', lang: 'en', setAppMode: vi.fn(), updateUI: vi.fn() }) }));

const privateMuseum = { id: 'museum-1', ownerId: 'owner', name: 'My Museum', description: '', isPublic: false, createdAt: '2026-01-01' };
const publicRoom = { id: 'room-1', museumId: 'museum-1', name: 'My Room', layout: 'square', isPublic: true, createdAt: '2026-01-01' };

describe('MuseumEditor publication controls', () => {
  beforeEach(() => {
    mocks.auth = { user: { id: 'owner' }, authLoading: false };
    mocks.museum = {
      loading: false, error: null,
      getMyMuseums: vi.fn().mockResolvedValue([privateMuseum]),
      updateMuseum: vi.fn().mockResolvedValue({ ...privateMuseum, isPublic: true }),
      getRooms: vi.fn().mockResolvedValue([publicRoom]),
      getRoom: vi.fn().mockResolvedValue(publicRoom),
      getRoomArtifacts: vi.fn().mockResolvedValue([]),
      updateRoom: vi.fn().mockResolvedValue({ ...publicRoom, isPublic: false }),
    };
  });

  it('starts private and publishes only the museum after database confirmation', async () => {
    render(<MuseumEditor />);
    fireEvent.click(await screen.findByRole('button', { name: 'Publish museum' }));
    await screen.findByRole('button', { name: 'Unpublish museum' });
    expect(mocks.museum.updateMuseum).toHaveBeenCalledWith('museum-1', { isPublic: true });
    expect(mocks.museum.updateRoom).not.toHaveBeenCalled();
    expect(screen.getByText(/New museums and rooms are private/)).toBeTruthy();
  });

  it('keeps the museum private when the database rejects publication', async () => {
    mocks.museum.updateMuseum.mockResolvedValue(null);
    render(<MuseumEditor />);
    fireEvent.click(await screen.findByRole('button', { name: 'Publish museum' }));
    await waitFor(() => expect(mocks.museum.updateMuseum).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: 'Unpublish museum' })).toBeNull();
  });

  it('explains that a public room remains hidden inside a private museum', async () => {
    render(<MuseumEditor />);
    fireEvent.click(await screen.findByText('My Museum'));
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    expect(await screen.findByText(/This room remains private to visitors until its museum is published/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Make room private' }));
    await screen.findByRole('button', { name: 'Mark room public' });
    expect(mocks.museum.updateRoom).toHaveBeenCalledWith('room-1', { isPublic: false });
    expect(mocks.museum.updateMuseum).not.toHaveBeenCalled();
  });

  it('does not change room visibility after a rejected update', async () => {
    mocks.museum.updateRoom.mockResolvedValue(null);
    render(<MuseumEditor />);
    fireEvent.click(await screen.findByText('My Museum'));
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Make room private' }));
    await waitFor(() => expect(mocks.museum.updateRoom).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: 'Mark room public' })).toBeNull();
  });

  it('shows the database error to the owner', async () => {
    mocks.museum.error = 'Publication denied';
    render(<MuseumEditor />);
    expect(screen.getByRole('alert').textContent).toBe('Publication denied');
  });

  it('clears the selected museum when the active account changes', async () => {
    const { rerender } = render(<MuseumApp />);
    fireEvent.click(await screen.findByText('My Museum'));
    await screen.findByText('My Room');

    mocks.museum.getMyMuseums.mockResolvedValue([]);
    mocks.auth.user = { id: 'second-account' };
    rerender(<MuseumApp />);

    expect(screen.queryByText('My Room')).toBeNull();
    await waitFor(() => expect(mocks.museum.getMyMuseums).toHaveBeenCalledWith('second-account'));
  });
});
