import { render, waitFor, act } from '@testing-library/react';
import { MuseumPanel } from '../MuseumPanel';
import React from 'react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

const mockResult = {
    title: 'Rosetta Stone',
    origin: { culture: 'Egyptian' },
    specs: { material: 'Granodiorite' }
};

describe('MuseumPanel Performance', () => {
    let fetchSpy: any;

    beforeEach(() => {
        fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
            // Simulate network delay
            await new Promise(resolve => setTimeout(resolve, 50));
            return {
                ok: true,
                json: async () => {
                    if (url.toString().includes('collectionapi.metmuseum.org/public/collection/v1/search')) {
                         return { objectIDs: [1] };
                    }
                    if (url.toString().includes('collectionapi.metmuseum.org/public/collection/v1/objects/')) {
                        return { objectID: 1, title: 'Test Object', primaryImageSmall: 'test.jpg' };
                    }
                    return {
                        title: 'Mock Title',
                        description: 'Mock Description',
                        extract: 'Mock Extract',
                        objectIDs: [1]
                    };
                }
            } as any;
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('measures fetch calls across multiple mounts', async () => {
        const startTime = performance.now();

        // Mount 1
        const { unmount: unmount1 } = render(
            <MuseumPanel result={mockResult as any} lang="en" />
        );

        await waitFor(() => {
            expect(fetchSpy.mock.calls.length).toBeGreaterThanOrEqual(2); // Met API and Wiki API
        });

        // Wait for all fetches to resolve
        await new Promise(resolve => setTimeout(resolve, 300));

        const fetchesAfterFirstMount = fetchSpy.mock.calls.length;
        unmount1();

        // Mount 2
        const { unmount: unmount2 } = render(
            <MuseumPanel result={mockResult as any} lang="en" />
        );

        // Wait for potential fetches
        await new Promise(resolve => setTimeout(resolve, 300));

        const fetchesAfterSecondMount = fetchSpy.mock.calls.length;
        unmount2();

        const endTime = performance.now();
        const totalTime = endTime - startTime;

        console.log(`BENCHMARK_RESULT: { "time": ${totalTime}, "fetches1": ${fetchesAfterFirstMount}, "fetches2": ${fetchesAfterSecondMount - fetchesAfterFirstMount} }`);
    });
});
