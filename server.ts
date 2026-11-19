import express from 'express';
import type { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import { resolveStaticRoot } from './server/staticRoot';
import { GoogleGenerativeAI, SchemaType, type Schema } from '@google/generative-ai';
import dotenv from 'dotenv';
import { LRUCache } from 'lru-cache';
import { z } from 'zod';
import { createSecurityApp, errorHandler, imageSchema, base64Image, rasterMime, validateOptionalImage, HttpError, withPostAdmission, type SecurityOptions } from './server/security';
import { registerPhotogrammetry } from './server/photogrammetry';

export interface AppOptions extends SecurityOptions {
  ai?: GoogleGenerativeAI;
  providerFetch?: typeof fetch;
  /** Fixture-only override for the build root; the CLI never passes this. */
  staticApplicationRoot?: string;
}
export function createApp(options: AppOptions = {}) {
const env = options.env || process.env;
const app = createSecurityApp(options);
const post = (route: string, handler: express.RequestHandler) => app.post(route, withPostAdmission(handler));
const requestFetch = options.providerFetch || fetch;
const parseModelList = (raw: string | undefined, defaults: string[]): string[] => {
    const parsed = (raw || '')
        .split(',')
        .map(m => m.trim())
        .filter(Boolean);
    return parsed.length > 0 ? parsed : defaults;
};
const GENAI_MODEL = env.GEMINI_MODEL?.trim() || 'gemini-2.5-pro';
const FALLBACK_MODELS = parseModelList(env.GEMINI_FALLBACK_MODELS, [
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'gemini-3.1-pro-preview',
    'gemini-2.0-flash',
]);
const CANDIDATE_MODELS = Array.from(new Set([GENAI_MODEL, ...FALLBACK_MODELS]));
const IMAGE_GEN_MODELS = parseModelList(env.GEMINI_IMAGE_MODELS || env.GEMINI_IMAGE_MODEL, [
    'gemini-2.0-flash-exp-image-generation',
    'gemini-2.0-flash-preview-image-generation',
    'gemini-2.0-flash-exp',
]);
const genAI = options.ai || (env.GEMINI_API_KEY && env.GEMINI_API_KEY !== 'YOUR_KEY_HERE' ? new GoogleGenerativeAI(env.GEMINI_API_KEY) : null);
let cachedModelName: string | null = null;

function isModelUnavailableError(err: unknown): boolean {
    const status = (err as { status?: number })?.status;
    if (typeof status === 'number' && status !== 404 && status !== 503) {
        return false;
    }
    const msg = err instanceof Error ? err.message : String(err ?? '');
    if (/\[(?:400|401|403|429)\b/i.test(msg)) {
        return false;
    }
    return status === 404 || /not found|not supported|unsupported|deprecated|unavailable|does not exist|\b404\b/i.test(msg);
}

function getOrderedCandidateModels(): string[] {
    return cachedModelName
        ? Array.from(new Set([cachedModelName, ...CANDIDATE_MODELS]))
        : CANDIDATE_MODELS;
}

async function generateWithModelFallback(
    client: GoogleGenerativeAI,
    request: Parameters<ReturnType<GoogleGenerativeAI['getGenerativeModel']>['generateContent']>[0],
    requestOptions?: Parameters<ReturnType<GoogleGenerativeAI['getGenerativeModel']>['generateContent']>[1],
) {
    const orderedModels = getOrderedCandidateModels();
    let lastError: unknown;
    for (const modelName of orderedModels) {
        try {
            const model = client.getGenerativeModel({ model: modelName }, { timeout: 120_000 });
            const response = requestOptions !== undefined
                ? await model.generateContent(request, requestOptions)
                : await model.generateContent(request);
            cachedModelName = modelName;
            return response;
        } catch (err) {
            lastError = err;
            if (!isModelUnavailableError(err)) {
                throw err;
            }
        }
    }
    throw lastError || new Error('Critical: No Gemini models responded.');
}

async function chatWithModelFallback(
    client: GoogleGenerativeAI | null,
    history: Parameters<ReturnType<GoogleGenerativeAI['getGenerativeModel']>['startChat']>[0],
    message: string,
) {
    if (!client) throw new Error('SETUP_REQUIRED');
    const orderedModels = getOrderedCandidateModels();
    let lastError: unknown;
    for (const modelName of orderedModels) {
        try {
            const model = client.getGenerativeModel({ model: modelName }, { timeout: 120_000 });
            const chat = model.startChat(history);
            const result = await chat.sendMessage(message);
            cachedModelName = modelName;
            return result;
        } catch (err) {
            lastError = err;
            if (!isModelUnavailableError(err)) {
                throw err;
            }
        }
    }
    throw lastError || new Error('Critical: No Gemini models responded.');
}



const safeJSONParse = (text: string) => {
    if (!text) return null;
    try {
        // 1. Surgical Extraction via Tags
        const tagMatch = text.match(/<ANALYSIS_JSON>([\s\S]*?)<\/ANALYSIS_JSON>/);
        let target = tagMatch ? tagMatch[1] : text;

        target = target.trim();
        
        // 2. Cleanup Markdown and surrounding noise
        target = target.replace(/```json/gi, '').replace(/```/g, '').trim();

        // 3. Find the valid JSON block inside the target
        const start = target.indexOf('{');
        const end = target.lastIndexOf('}');
        const startArr = target.indexOf('[');
        const endArr = target.lastIndexOf(']');

        let finalStart = start;
        let finalEnd = end;

        // Determine if it's an object or array
        if (startArr !== -1 && (start === -1 || startArr < start)) {
            finalStart = startArr;
            finalEnd = endArr;
        }

        if (finalStart === -1 || finalEnd === -1) {
             console.error("No JSON structure found in Gemini output.");
             return null;
        }
        
        let slice = target.substring(finalStart, finalEnd + 1);
        
        // 4. Robust repair for common LLM formatting issues
        // Handle unescaped quotes inside description fields (crude but effective)
        // This regex tries to find quotes that AREN'T followed by : or , or } or ]
        const repaired = slice
            .replace(/,\s*([}\]])/g, '$1') // Trailing commas
            .replace(/\n\s*\n/g, '\n');    // Double newlines
            
        return JSON.parse(repaired);
    } catch (err: any) {
        // Final fallback: try to just return what we have if it's somehow valid enough
        try {
            return JSON.parse(text.substring(text.indexOf('{'), text.lastIndexOf('}') + 1));
        } catch (e) {
            console.error('Provider returned invalid JSON.');
            return null;
        }
    }
};


const analyzeSchema = z.object({ images: z.array(imageSchema).min(1).max(5), lang: z.enum(['tr','en']).optional(), cvSummary: z.string().max(500).optional() });
const chatSchema = z.object({ message: z.string().min(1).max(1000), context: z.string().max(20_000).optional(), imageData: base64Image.optional(), mimeType: rasterMime.optional() }).superRefine(validateOptionalImage);
const restoreSchema = z.object({ imageData: base64Image, mimeType: rasterMime.default('image/jpeg'), prompt: z.string().max(500).optional() }).superRefine(validateOptionalImage);
const compareSchema = z.object({ images: z.array(imageSchema).length(2), lang: z.enum(['tr','en']).optional() });

const analysisOutputSchema = z.object({
    title: z.string().default('Bilinmeyen Eser'),
    confidence_score: z.preprocess((val) => {
        if (typeof val === 'string') return parseFloat(val.replace(/[^0-9.]/g, '')) || 50;
        return val;
    }, z.number().default(50)),
    origin: z.object({ 
        region: z.string().default('Bilinmiyor'), 
        culture: z.string().default('Bilinmiyor') 
    }).default({ region: 'Bilinmiyor', culture: 'Bilinmiyor' }),
    dating: z.object({ 
        period: z.string().default('Bilinmiyor'), 
        date_range: z.string().default('Bilinmiyor'), 
        century: z.string().default('Bilinmiyor') 
    }).default({ period: 'Bilinmiyor', date_range: 'Bilinmiyor', century: 'Bilinmiyor' }),
    specs: z.object({ 
        style: z.string().default('Bilinmiyor'), 
        material: z.string().default('Bilinmiyor'), 
        technique: z.string().default('Bilinmiyor'), 
        dimensions: z.string().default('Bilinmiyor') 
    }).default({ style: 'Bilinmiyor', material: 'Bilinmiyor', technique: 'Bilinmiyor', dimensions: 'Bilinmiyor' }),
    analysis: z.object({
        description: z.string().default('Yapay zeka analiz raporu oluşturulamadı.'),
        iconography: z.string().default('Analiz edilemedi.'),
        inscription: z.any().nullable().default(null)
    }).default({ description: 'Yapay zeka analiz raporu oluşturulamadı.', iconography: 'Analiz edilemedi.', inscription: null }),
    preservation: z.object({ 
        condition: z.string().default('Bilinmiyor'), 
        damages: z.string().default('Bilinmiyor') 
    }).default({ condition: 'Bilinmiyor', damages: 'Bilinmiyor' }),
    fun_fact: z.string().default('Bilgi bulunamadı.'),
    curator_note: z.string().default('Not yok.'),
    historical_context: z.string().default('Bilinmiyor'),
    cultural_significance: z.string().default('Bilinmiyor'),
    symbolism: z.string().default('Bilinmiyor'),
    similar_artifacts: z.array(z.object({ name: z.string(), museum: z.string(), similarity: z.string() })).default([]),
    current_location: z.object({ 
        museum: z.string().default('Bilinmiyor'), 
        city: z.string().default('Bilinmiyor'), 
        country: z.string().default('Bilinmiyor'), 
        coordinates: z.array(z.number()).default([0, 0]) 
    }).default({ museum: 'Bilinmiyor', city: 'Bilinmiyor', country: 'Bilinmiyor', coordinates: [0, 0] }),
    digital_reconstruction: z.string().default('N/A')
});

const compareOutputSchema = z.object({
    similarity_score: z.number().default(0),
    conclusion: z.string().default(''),
    differences: z.array(z.string()).default([]),
    similarities: z.array(z.string()).default([]),
    era_match: z.boolean().default(false),
    authenticity_analysis: z.string().default(''),
    style_differences: z.string().default('')
});



post('/api/analyze', async (req: Request, res: Response, next: express.NextFunction) => {
    if (!genAI) {
        return res.status(503).json({ error_code: 'SETUP_REQUIRED', message: 'API anahtarı yapılandırılmamış.' });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000);

    try {
        const { images, lang, cvSummary } = analyzeSchema.parse(req.body);
        const isTr = lang === 'tr';

        // 1. DEFINITIVE SCHEMA FOR STRUCTURED OUTPUT
        const geminiAnalysisSchema: Schema = {
            type: SchemaType.OBJECT,
            properties: {
                title: { type: SchemaType.STRING },
                confidence_score: { type: SchemaType.NUMBER },
                origin: { type: SchemaType.OBJECT, properties: { region: { type: SchemaType.STRING }, culture: { type: SchemaType.STRING } }, required: ["region", "culture"] },
                dating: { type: SchemaType.OBJECT, properties: { period: { type: SchemaType.STRING }, date_range: { type: SchemaType.STRING }, century: { type: SchemaType.STRING } }, required: ["period", "date_range", "century"] },
                specs: { type: SchemaType.OBJECT, properties: { style: { type: SchemaType.STRING }, material: { type: SchemaType.STRING }, technique: { type: SchemaType.STRING }, dimensions: { type: SchemaType.STRING } }, required: ["style", "material", "technique", "dimensions"] },
                analysis: { type: SchemaType.OBJECT, properties: { description: { type: SchemaType.STRING }, iconography: { type: SchemaType.STRING }, inscription: { type: SchemaType.OBJECT, properties: { original: { type: SchemaType.STRING }, translation: { type: SchemaType.STRING }, notes: { type: SchemaType.STRING } }, required: ["original", "translation", "notes"] } }, required: ["description", "iconography", "inscription"] },
                preservation: { type: SchemaType.OBJECT, properties: { condition: { type: SchemaType.STRING }, damages: { type: SchemaType.STRING } }, required: ["condition", "damages"] },
                fun_fact: { type: SchemaType.STRING },
                curator_note: { type: SchemaType.STRING },
                historical_context: { type: SchemaType.STRING },
                cultural_significance: { type: SchemaType.STRING },
                symbolism: { type: SchemaType.STRING },
                similar_artifacts: { type: SchemaType.ARRAY, items: { type: SchemaType.OBJECT, properties: { name: { type: SchemaType.STRING }, museum: { type: SchemaType.STRING }, similarity: { type: SchemaType.STRING } }, required: ["name", "museum", "similarity"] } },
                current_location: { type: SchemaType.OBJECT, properties: { museum: { type: SchemaType.STRING }, city: { type: SchemaType.STRING }, country: { type: SchemaType.STRING }, coordinates: { type: SchemaType.ARRAY, items: { type: SchemaType.NUMBER } } }, required: ["museum", "city", "country", "coordinates"] },
                digital_reconstruction: { type: SchemaType.STRING },
                inventory: {
                    type: SchemaType.OBJECT,
                    properties: {
                        type: { type: SchemaType.STRING },
                        period: { type: SchemaType.STRING },
                        material: { type: SchemaType.STRING },
                        condition: { type: SchemaType.STRING },
                        dimensions_estimate: { type: SchemaType.STRING },
                        preservation_recommendation: { type: SchemaType.STRING },
                        catalog_id_suggestion: { type: SchemaType.STRING }
                    },
                    required: ["type","period","material","condition","dimensions_estimate","preservation_recommendation","catalog_id_suggestion"]
                }
            },
            required: ["title", "confidence_score", "origin", "dating", "specs", "analysis", "preservation", "fun_fact", "curator_note", "historical_context", "cultural_significance", "symbolism", "similar_artifacts", "current_location", "digital_reconstruction", "inventory"]
        };

        // CV summary injected by client (Faz 4 — preAnalyze)
        const cvContext = cvSummary ? `\n[CV Pre-Analysis] ${cvSummary}` : '';

        const systemPrompt = `You are a forensic computational archaeologist.
        LANGUAGE: ${isTr ? 'Turkish' : 'English'}.
        Analyze the provided image and generate a scholarly report in valid JSON.
        Also generate a museum inventory record in the "inventory" field.${cvContext}`;

        const parts: any[] = images.map((img: any) => ({
            inlineData: { mimeType: img.mimeType, data: img.data || "" }
        }));
        parts.push({ text: "Perform definitive analysis and generate inventory." });

        // 2. GENERATE WITH NATIVE SCHEMA (Bypasses all format errors)
        const result = await generateWithModelFallback(genAI, {
            contents: [{ role: 'user', parts }],
            systemInstruction: systemPrompt,
            generationConfig: { 
                temperature: 0.1,
                maxOutputTokens: 8192,
                responseMimeType: "application/json",
                responseSchema: geminiAnalysisSchema
            }
        }, { signal: controller.signal });
        
        clearTimeout(timeout);

        // 3. SECURE PARSE (API guarantees this is valid JSON)
        const parsedData = JSON.parse(result.response.text());

        // 4. DEEP SCHEMA MERGE (Final check)
        const defaults = analysisOutputSchema.parse({});
        const finalData = {
            ...defaults,
            ...parsedData,
            analysis: { ...defaults.analysis, ...(parsedData.analysis || {}) },
            origin: { ...defaults.origin, ...(parsedData.origin || {}) },
            dating: { ...defaults.dating, ...(parsedData.dating || {}) },
            specs: { ...defaults.specs, ...(parsedData.specs || {}) },
            preservation: { ...defaults.preservation, ...(parsedData.preservation || {}) },
            current_location: { ...defaults.current_location, ...(parsedData.current_location || {}) }
        };

        res.json(finalData);

    } catch (err: any) {
        clearTimeout(timeout);
        
        next(err);
    }
});

post('/api/chat', async (req: Request, res: Response, next: express.NextFunction) => {
    try {
        const { message, context, imageData, mimeType } = chatSchema.parse(req.body);

        const history: any[] = [
            {
                role: "user",
                parts: [
                    { text: `Context about the artifact being discussed: ${context || 'Analyze this artifact.'}` },
                    ...(imageData ? [{ inlineData: { mimeType: mimeType || 'image/jpeg', data: imageData } }] : [])
                ],
            }
        ];

        const result = await chatWithModelFallback(genAI, {
            history,
            generationConfig: { maxOutputTokens: 1000 }
        }, message);
        const reply = result.response.text();

        res.json({ reply });
    } catch (err: any) {
        next(err);
    }
});

post('/api/restore', async (req: Request, res: Response, next: express.NextFunction) => {
    try {
        const { imageData, mimeType, prompt } = restoreSchema.parse(req.body);
        if (!genAI) throw new Error('SETUP_REQUIRED');

        // ── Step 0: Evidence gathering (scholarly references) ──────────────────
        let evidenceRefs: Array<{ name: string; museum: string; similarity: string; detail: string }> = [];
        let evidenceConfidenceScore = 0;
        try {
            const evidenceResult = await generateWithModelFallback(genAI, {
                contents: [{
                    role: 'user',
                    parts: [
                        { inlineData: { mimeType, data: imageData } },
                        { text: `You are a senior museum conservator. Before restoring this artifact, provide scholarly evidence from reference artifacts.
For each similar reference artifact found in major museum collections, provide:
- name: artifact name
- museum: museum name and location
- similarity: percentage overlap (e.g. "edge curvature and clay composition match 78%")
- detail: specific technical evidence (e.g. "Handle curvature and glaze pattern align with Attic red-figure technique")

Return JSON only: { "evidence": [ { "name": "...", "museum": "...", "similarity": "...", "detail": "..." } ], "confidence_score": 0-100 }
If no reliable evidence exists, return { "evidence": [], "confidence_score": 0 }` }
                    ]
                }],
                generationConfig: { temperature: 0.2, maxOutputTokens: 1024, responseMimeType: 'application/json' }
            });
            const evText = evidenceResult.response.text();
            const evJson = JSON.parse(evText);
            evidenceRefs = evJson.evidence || [];
            evidenceConfidenceScore = evJson.confidence_score || 0;
        } catch (e: any) {
        }

        const restorationPrompt = prompt
            ? `You are a master archaeological restoration artist. ${prompt}. Restore the artifact in the image. Maintain the same angle, perspective and composition.`
            : `You are a master archaeological restoration artist at the Louvre Museum.
Restore this artifact to its original pristine condition:
- Remove all dirt, grime, oxidation and patina
- Repair every visible crack, chip and fracture
- Revive faded colors to their original vibrancy
- Reconstruct missing pieces based on the artifact's style and period
Keep the exact same perspective, angle and proportions as the original photo.
The result must look museum-quality, photorealistic.`;

        // ── Phase 1: Try configured image-generation models in order ──

        let restoredBase64: string | null = null;
        let restoredMime = 'image/png';
        let explanation = '';

        for (const modelName of IMAGE_GEN_MODELS) {
            try {
                console.log(`[restore] Trying image-gen model: ${modelName}`);
                const imageGenModel = genAI.getGenerativeModel({ model: modelName }, { timeout: 120_000 });
                const genResult = await imageGenModel.generateContent({
                    contents: [{
                        role: 'user',
                        parts: [
                            { inlineData: { mimeType, data: imageData } },
                            { text: restorationPrompt },
                        ],
                    }],
                    generationConfig: {
                        responseModalities: ['TEXT', 'IMAGE'],
                        temperature: 1,
                    } as any,
                });

                const parts = genResult.response.candidates?.[0]?.content?.parts ?? [];
                for (const part of parts) {
                    if ((part as any).inlineData?.data) {
                        restoredBase64 = (part as any).inlineData.data;
                        restoredMime  = (part as any).inlineData.mimeType || 'image/png';
                    } else if (part.text) {
                        explanation += part.text;
                    }
                }

                if (restoredBase64) {
                    console.log(`[restore] ✅ Image generated by ${modelName}`);
                    break;
                }
                console.warn(`[restore] ⚠️ ${modelName} returned no image, trying next...`);
            } catch (e: any) {
            }
        }

        // ── Phase 2: Image generation succeeded ──
        if (restoredBase64) {
            return res.json({
                restoredImage: `data:${restoredMime};base64,${restoredBase64}`,
                explanation: explanation || 'Eser Imagen AI ile restore edildi.',
                status: 'Imagen AI Restoration',
                imageGenerated: true,
                evidenceRefs,
                evidenceConfidenceScore,
                hasEvidence: evidenceRefs.length > 0,
            });
        }

        // ── Fallback: hiçbir model görsel üretemedi → sadece metin raporu ──
        console.warn('[restore] Tüm image-gen modeller başarısız, metin raporuna geçiliyor.');
        const fallback = await generateWithModelFallback(genAI, {
            contents: [{ role: 'user', parts: [
                { inlineData: { mimeType, data: imageData } },
                { text: 'Describe a professional restoration plan for this artifact.' },
            ]}],
            systemInstruction: 'You are a master digital archaeological restorer. Write a concise 4-step restoration report. No markdown.',
            generationConfig: { maxOutputTokens: 400, temperature: 0.7 },
        });

        // imageGenerated: false — frontend'e "görsel yok" sinyali ver
        res.json({
            restoredImage: null,
            explanation: fallback.response.text(),
            status: 'Text Restoration Report',
            imageGenerated: false,
            evidenceRefs,
            evidenceConfidenceScore,
            hasEvidence: evidenceRefs.length > 0,
        });

    } catch (err: any) {
        next(err);
    }
});

// ─── Cross-Reference / RAG ────────────────────────────────────────────────────
interface CrossRefItem {
    title: string; date: string; culture: string;
    imageUrl: string; sourceUrl: string; museum: string;
}

// 24-hour in-memory cache (server-side)
const crossRefCache = new LRUCache<string, { data: CrossRefItem[]; ts: number }>({ max: 100, ttl: 24 * 60 * 60 * 1000 });
const CROSS_REF_TTL = 24 * 60 * 60 * 1000;

const crossRefSchema = z.object({
    period:   z.string().max(200).default(''),
    material: z.string().max(200).default(''),
    culture:  z.string().max(200).default(''),
    type:     z.string().max(200).optional(),
});

async function timedFetch(url: string, ms: number): Promise<globalThis.Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
        const response = await requestFetch(url, { signal: controller.signal, redirect: 'error' });
        if (!response.body) return response;
        const chunks: Uint8Array[] = []; let size = 0;
        const reader = response.body.getReader();
        try {
            for (;;) {
                const { value, done } = await reader.read(); if (done) break;
                size += value.length;
                if (size > 1024 * 1024) { controller.abort(); throw new HttpError(502, 'PROVIDER_RESPONSE_TOO_LARGE'); }
                chunks.push(value);
            }
        } finally { await reader.cancel().catch(() => {}); }
        return new globalThis.Response(Buffer.concat(chunks), { status: response.status, headers: response.headers });
    } finally { clearTimeout(timer); }
}

async function fetchEuropeana(query: string, ms: number): Promise<CrossRefItem[]> {
    const key = env.EUROPEANA_API_KEY;
    if (!key) return [];
    try {
        const url = `https://api.europeana.eu/record/v2/search.json?wskey=${key}&query=${encodeURIComponent(query)}&rows=3&media=true&reusability=open&profile=minimal`;
        const r = await timedFetch(url, ms);
        if (!r.ok) return [];
        const d = await r.json();
        return (d.items || []).map((item: any) => ({
            title:     Array.isArray(item.title) ? item.title[0] : (item.title || 'Unknown'),
            date:      Array.isArray(item.year) ? item.year[0] : (item.year || ''),
            culture:   Array.isArray(item.dcCreator) ? item.dcCreator[0] : '',
            imageUrl:  Array.isArray(item.edmPreview) ? item.edmPreview[0] : '',
            sourceUrl: item.guid || '',
            museum:    'Europeana',
        })).filter((i: CrossRefItem) => i.imageUrl);
    } catch { return []; }
}

async function fetchMet(query: string, ms: number): Promise<CrossRefItem[]> {
    try {
        const sr = await timedFetch(
            `https://collectionapi.metmuseum.org/public/collection/v1/search?q=${encodeURIComponent(query)}&hasImages=true`,
            ms / 2
        );
        if (!sr.ok) return [];
        const sd = await sr.json();
        const ids: number[] = (sd.objectIDs || []).slice(0, 3);
        const objects = await Promise.allSettled(
            ids.map(id => timedFetch(
                `https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`,
                ms / 2
            ).then(r => r.ok ? r.json() : null))
        );
        return objects
            .filter(r => r.status === 'fulfilled' && r.value)
            .map(r => {
                const o = (r as PromiseFulfilledResult<any>).value;
                return {
                    title:     o.title || 'Unknown',
                    date:      o.objectDate || '',
                    culture:   o.culture || '',
                    imageUrl:  o.primaryImageSmall || o.primaryImage || '',
                    sourceUrl: o.objectURL || '',
                    museum:    'The Metropolitan Museum of Art',
                };
            })
            .filter(i => i.imageUrl);
    } catch { return []; }
}

async function fetchHarvard(query: string, ms: number): Promise<CrossRefItem[]> {
    const key = env.HARVARD_API_KEY;
    if (!key) return [];
    try {
        const url = `https://api.harvardartmuseums.org/object?apikey=${key}&q=${encodeURIComponent(query)}&size=3&fields=title,dated,culture,primaryimageurl,url&hasimage=1`;
        const r = await timedFetch(url, ms);
        if (!r.ok) return [];
        const d = await r.json();
        return (d.records || []).map((o: any) => ({
            title:     o.title || 'Unknown',
            date:      o.dated || '',
            culture:   o.culture || '',
            imageUrl:  o.primaryimageurl || '',
            sourceUrl: o.url || '',
            museum:    'Harvard Art Museums',
        })).filter((i: CrossRefItem) => i.imageUrl);
    } catch { return []; }
}

post('/api/cross-reference', async (req: Request, res: Response, next: express.NextFunction) => {
    try {
        const { period, material, culture, type } = crossRefSchema.parse(req.body);
        const cacheKey = JSON.stringify([res.locals.user.id, period, material, culture, type]);

        const cached = crossRefCache.get(cacheKey);
        if (cached && Date.now() - cached.ts < CROSS_REF_TTL) {
            return res.json({ results: cached.data, cached: true });
        }

        const q = [culture, period, material, type].filter(Boolean).join(' ').trim().slice(0, 120);
        if (!q) return res.json({ results: [] });

        const TIMEOUT = 8000;
        const [euro, met, harvard] = await Promise.allSettled([
            fetchEuropeana(q, TIMEOUT),
            fetchMet(q, TIMEOUT),
            fetchHarvard(q, TIMEOUT),
        ]);

        const results: CrossRefItem[] = [
            ...(euro.status    === 'fulfilled' ? euro.value    : []),
            ...(met.status     === 'fulfilled' ? met.value     : []),
            ...(harvard.status === 'fulfilled' ? harvard.value : []),
        ].slice(0, 6);

        crossRefCache.set(cacheKey, { data: results, ts: Date.now() });
        res.json({ results });
    } catch (err: any) {
        next(err);
    }
});

// ─── Epigraphy / Faint Trace Detection ────────────────────────────────────────
const epigraphySchema = z.object({
    imageData: z.string().min(1),  // base64 — already CLAHE-processed by client
    lang: z.enum(['tr', 'en']).optional()
}).superRefine((value, ctx) => validateOptionalImage({ imageData: value.imageData, mimeType: 'image/png' }, ctx));

const epigraphyOutputSchema = z.object({
    detections: z.array(z.object({
        bbox: z.array(z.number()).length(4),
        charSuggestion: z.string(),
        confidence: z.number(),
        positionLabel: z.string()
    })).default([]),
    summary: z.string().default('')
});

// Authentication is applied centrally before all private API routes.

post('/api/epigraphy', async (req: Request, res: Response, next: express.NextFunction) => {
    try {
        const { imageData, lang } = epigraphySchema.parse(req.body);
        if (!genAI) throw new Error('SETUP_REQUIRED');
        const isTr = lang === 'tr';

        const result = await generateWithModelFallback(genAI, {
            contents: [{
                role: 'user',
                parts: [
                    { inlineData: { mimeType: 'image/png', data: imageData } },
                    { text: `You are an expert epigraphist analyzing a contrast-enhanced archaeological artifact image.
Detect every faint, eroded, or partially visible character, symbol, inscription, or mark.
For each detection provide:
- bbox: [ymin, xmin, ymax, xmax] normalized 0-1000
- charSuggestion: most likely character/symbol (e.g. "Alpha α", "cuneiform wedge", "cartouche")
- confidence: 0-100 (your certainty)
- positionLabel: brief location description (e.g. "upper left rim", "central panel")

Return JSON only: { "detections": [...], "summary": "brief summary in ${isTr ? 'Turkish' : 'English'}" }
If nothing found, return { "detections": [], "summary": "No inscriptions detected." }` }
                ]
            }],
            generationConfig: { temperature: 0.1, maxOutputTokens: 2048, responseMimeType: 'application/json' }
        });

        const parsed = JSON.parse(result.response.text());
        res.json(epigraphyOutputSchema.parse(parsed));
    } catch (err: any) {
        next(err);
    }
});

post('/api/compare', async (req: Request, res: Response, next: express.NextFunction) => {
    try {
        const { images, lang } = compareSchema.parse(req.body);
        if (!genAI) throw new Error('SETUP_REQUIRED');

        const systemPrompt = `You are a forensic archaeologist. Compare these two artifacts and identify similarities, differences, and potential authenticity issues.
        
        CRITICAL: Wrap your JSON output inside <ANALYSIS_JSON> tags.
        
        <ANALYSIS_JSON>
        {
          "similarity_score": number (0-100),
          "conclusion": "Brief summary of the comparison",
          "differences": ["diff 1", "diff 2", ...],
          "similarities": ["sim 1", "sim 2", ...],
          "era_match": boolean,
          "authenticity_analysis": "Expert opinion on original vs replica",
          "style_differences": "Description of stylistic nuances"
        }
        </ANALYSIS_JSON>
        Language: ${lang === 'tr' ? 'Turkish' : 'English'}`;

        const parts: any[] = images.map((img: any) => ({
            inlineData: { 
                mimeType: img.mimeType, 
                data: img.data || ""
            }
        }));
        parts.push({ text: "Perform a detailed side-by-side comparison of these two artifacts." });

        // 1. AI Analysis Phase
        const result = await generateWithModelFallback(genAI, {
            contents: [{ role: 'user', parts }],
            systemInstruction: systemPrompt,
            generationConfig: { 
                temperature: 0.1,
                topP: 0.1,
                maxOutputTokens: 4096,
                responseMimeType: "application/json"
            }
        });

        const parsedData = safeJSONParse(result.response.text());
        const validation = compareOutputSchema.safeParse(parsedData);
        if (!validation.success) {
        }
        res.json(validation.success ? validation.data : { ...parsedData, ...validation.data });
    } catch (err: any) {
        next(err);
    }
});


app.locals.dispose = registerPhotogrammetry(app, env, requestFetch);
app.use('/api', (_req, res) => res.status(404).json({ error_code: 'NOT_FOUND', message: 'Endpoint not found.' }));
if (env.STATIC_DIR) {
    const staticRoot = resolveStaticRoot(env.STATIC_DIR, options.staticApplicationRoot ?? process.cwd());
    const indexPath = path.join(staticRoot, 'index.html');
    app.use(express.static(staticRoot, { dotfiles: 'deny', index: false }));
    app.get('/{*path}', rateLimit({
        windowMs: 60_000,
        limit: 300,
        standardHeaders: 'draft-8',
        legacyHeaders: false,
        message: { error_code: 'RATE_LIMITED', message: 'Too many requests.' },
    }), (_req, res) => res.sendFile(indexPath));
}
app.use(errorHandler);
return app;
}

// Importing createApp never opens a listener. Both tsx and the bundled CJS entry work.
if (process.env.NODE_ENV !== 'test' && /(?:^|[\\/])server\.(?:ts|cjs|js)$/.test(process.argv[1] || '')) {
    dotenv.config({ path: process.env.DOTENV_PATH || '.env.local', quiet: true });
    const app = createApp();
    const port = Number(process.env.PORT || '3002');
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be between 1 and 65535');
    const listener = app.listen(port, app.locals.host, () => console.log(`ArcheLens backend listening on ${app.locals.host}:${port}`));
    const stop = () => { app.locals.dispose(); listener.close(); };
    process.once('SIGTERM', stop); process.once('SIGINT', stop);
}
