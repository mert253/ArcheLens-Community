/**
 * ArcheLens Open Source — Centralized API Layer
 * All AI and external API calls go through this service.
 * Requests are routed to the local Node.js backend.
 */

import { AnalysisResult, GroundingSource, Language } from '../types';
import { supabase, isSupabaseConfigured } from './supabase';

import { API_BASE as API_BASE_URL } from './config';

export async function getAuthHeaders(json = true, expectedUserId?: string | null): Promise<Record<string, string>> {
    const headers: Record<string, string> = json ? { 'Content-Type': 'application/json' } : {};
    if (!isSupabaseConfigured) return headers;
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw new Error('Please sign in again.');
    if (expectedUserId !== undefined && (session?.user.id ?? null) !== expectedUserId) {
        throw new DOMException('The active account changed.', 'AbortError');
    }
    if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
    return headers;
}

// ─── ANALYSIS ────────────────────────────────────────────────
export async function analyzeArtifact(
    base64Data: string,
    mimeType: string,
    lang?: Language,
    cvSummary?: string,
    expectedUserId?: string | null,
): Promise<AnalysisResult> {
    const response = await fetch(`${API_BASE_URL}/analyze`, {
        method: 'POST',
        headers: await getAuthHeaders(true, expectedUserId),
        body: JSON.stringify({
            images: [{ data: base64Data, mimeType }],
            lang: lang || 'tr',
            ...(cvSummary ? { cvSummary } : {}),
        }),
    });

    if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || errData.details || errData.error || 'API request failed');
    }

    return await response.json();
}

// ─── COMPARISON ──────────────────────────────────────────────
export async function compareArtifacts(
    files: { base64Data: string; mimeType: string }[],
    lang?: Language,
    expectedUserId?: string | null,
): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/compare`, {
        method: 'POST',
        headers: await getAuthHeaders(true, expectedUserId),
        body: JSON.stringify({
            images: files.map(f => ({ data: f.base64Data, mimeType: f.mimeType })),
            lang: lang || 'tr',
        }),
    });

    if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || errData.error || 'Comparison required failed');
    }

    return await response.json();
}

// ─── RESTORATION ─────────────────────────────────────────────
export async function restoreArtifact(
    base64Data: string,
    mimeType: string,
    prompt: string,
    expectedUserId?: string | null,
): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/restore`, {
        method: 'POST',
        headers: await getAuthHeaders(true, expectedUserId),
        body: JSON.stringify({
            imageData: base64Data,
            mimeType,
            prompt,
        }),
    });

    if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || errData.error || 'Restoration failed');
    }

    const data = await response.json();
    return data;
}

// ─── CHAT ────────────────────────────────────────────────────
export async function chatWithArtifact(
    message: string,
    context: string,
    imageBase64?: string | null,
    imageMimeType?: string
): Promise<string> {
    const response = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({
            message,
            context,
            imageData: imageBase64,
            mimeType: imageMimeType,
        }),
    });

    if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || errData.error || 'Chat request failed');
    }

    const data = await response.json();
    return data.reply;
}

// ─── CROSS-REFERENCE ─────────────────────────────────────────
export async function fetchCrossReference(params: {
    period: string; material: string; culture: string; type?: string;
}): Promise<{ results: import('../types').CrossRefItem[] }> {
    const response = await fetch(`${API_BASE_URL}/cross-reference`, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify(params),
    });
    if (!response.ok) throw new Error('Cross-reference failed');
    return response.json();
}

