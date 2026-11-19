import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    analyzeArtifact,
    compareArtifacts,
    restoreArtifact,
    chatWithArtifact,
    fetchCrossReference
} from '../api';

const mockBaseUrl = '/api';

describe('API functions', () => {
    let fetchMock: any;

    beforeEach(() => {
        // Mock global.fetch
        fetchMock = vi.spyOn(global, 'fetch');
        // We might want to mock env vars but VITE_API_URL handles gracefully
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('analyzeArtifact', () => {
        it('should return analysis result on success', async () => {
            const mockResponse = { id: '123', type: 'Vase' };
            fetchMock.mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
            });

            const result = await analyzeArtifact('base64', 'image/jpeg', 'en', 'cv_summary');

            expect(fetchMock).toHaveBeenCalledWith(`${mockBaseUrl}/analyze`, expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({
                    images: [{ data: 'base64', mimeType: 'image/jpeg' }],
                    lang: 'en',
                    cvSummary: 'cv_summary'
                })
            }));
            expect(result).toEqual(mockResponse);
        });

        it('should throw error when response is not ok with JSON payload', async () => {
            fetchMock.mockResolvedValueOnce({
                ok: false,
                json: async () => ({ message: 'API validation error' }),
            });

            await expect(analyzeArtifact('base64', 'image/jpeg')).rejects.toThrow('API validation error');
        });

        it('should throw generic error when response is not ok and JSON parsing fails', async () => {
            fetchMock.mockResolvedValueOnce({
                ok: false,
                json: async () => { throw new Error('Not JSON'); },
            });

            await expect(analyzeArtifact('base64', 'image/jpeg')).rejects.toThrow('API request failed');
        });
    });

    describe('compareArtifacts', () => {
        it('should return comparison result on success', async () => {
            const mockResponse = { similarity: 0.95 };
            fetchMock.mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
            });

            const files = [{ base64Data: 'file1', mimeType: 'image/png' }];
            const result = await compareArtifacts(files, 'tr');

            expect(fetchMock).toHaveBeenCalledWith(`${mockBaseUrl}/compare`, expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({
                    images: [{ data: 'file1', mimeType: 'image/png' }],
                    lang: 'tr'
                })
            }));
            expect(result).toEqual(mockResponse);
        });

        it('should throw error on failure', async () => {
            fetchMock.mockResolvedValueOnce({
                ok: false,
                json: async () => ({ error: 'Comparison failed' }),
            });

            const files = [{ base64Data: 'file1', mimeType: 'image/png' }];
            await expect(compareArtifacts(files)).rejects.toThrow('Comparison failed');
        });
    });

    describe('restoreArtifact', () => {
        it('should return restored artifact on success', async () => {
            const mockResponse = { restoredImage: 'base64_restored' };
            fetchMock.mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
            });

            const result = await restoreArtifact('base64_original', 'image/jpeg', 'Fix the crack');

            expect(fetchMock).toHaveBeenCalledWith(`${mockBaseUrl}/restore`, expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({
                    imageData: 'base64_original',
                    mimeType: 'image/jpeg',
                    prompt: 'Fix the crack'
                })
            }));
            expect(result).toEqual(mockResponse);
        });

        it('should throw error on failure', async () => {
            fetchMock.mockResolvedValueOnce({
                ok: false,
                json: async () => ({ error: 'Restoration error' }),
            });

            await expect(restoreArtifact('base64', 'image/png', 'fix')).rejects.toThrow('Restoration error');
        });
    });

    describe('chatWithArtifact', () => {
        it('should return chat reply on success', async () => {
            const mockResponse = { reply: 'This is an ancient vase.' };
            fetchMock.mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
            });

            const result = await chatWithArtifact('What is this?', 'Context data', 'base64', 'image/jpeg');

            expect(fetchMock).toHaveBeenCalledWith(`${mockBaseUrl}/chat`, expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({
                    message: 'What is this?',
                    context: 'Context data',
                    imageData: 'base64',
                    mimeType: 'image/jpeg'
                })
            }));
            expect(result).toEqual('This is an ancient vase.');
        });

        it('should throw error on failure', async () => {
            fetchMock.mockResolvedValueOnce({
                ok: false,
                json: async () => ({ error: 'Chat backend error' }),
            });

            await expect(chatWithArtifact('hello', 'context')).rejects.toThrow('Chat backend error');
        });
    });

    describe('fetchCrossReference', () => {
        it('should return cross reference results on success', async () => {
            const mockResponse = { results: [{ title: 'Similar Vase' }] };
            fetchMock.mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
            });

            const result = await fetchCrossReference({ period: 'Roman', material: 'Clay', culture: 'Roman' });

            expect(fetchMock).toHaveBeenCalledWith(`${mockBaseUrl}/cross-reference`, expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({
                    period: 'Roman',
                    material: 'Clay',
                    culture: 'Roman'
                })
            }));
            expect(result).toEqual(mockResponse);
        });

        it('should throw error on failure', async () => {
            fetchMock.mockResolvedValueOnce({
                ok: false,
                json: async () => ({}),
            });

            await expect(fetchCrossReference({ period: 'Roman', material: 'Clay', culture: 'Roman' })).rejects.toThrow('Cross-reference failed');
        });
    });
});
