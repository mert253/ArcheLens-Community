import { z } from 'zod';
import type { AnalysisResult, StoredAnnotation } from '../../types';

export const MAX_PEERS = 32;
export const MAX_PATH_POINTS = 1024;
export const MAX_ANNOTATIONS = 100;
export const MAX_STROKES = 64;
export const MAX_BUFFERED_POINTS = 20_000;
export const uuidSchema = z.string().uuid();
export const displayNameSchema = z.string().trim().min(1).max(80).regex(/^[^\u0000-\u001f\u007f]+$/u);
export const colorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const coordinateSchema = z.number().finite().min(0).max(1);
export const pointSchema = z.object({ x: coordinateSchema, y: coordinateSchema });
const pointPathSchema = z.preprocess(value => Array.isArray(value) && value.length > MAX_PATH_POINTS ? undefined : value, z.array(pointSchema).min(2).max(MAX_PATH_POINTS));
export const widthSchema = z.number().finite().min(1).max(20);
export const cursorPayloadSchema = z.object({ userId: uuidSchema, name: displayNameSchema, color: colorSchema, cursorX: coordinateSchema, cursorY: coordinateSchema });
export const drawPayloadSchemas = {
  draw_start: z.object({ userId: uuidSchema, color: colorSchema, width: widthSchema, point: pointSchema }),
  draw_point: z.object({ userId: uuidSchema, point: pointSchema }),
  draw_end: z.object({ userId: uuidSchema, color: colorSchema, width: widthSchema, path: pointPathSchema }),
};
export const annotationIdPayloadSchema = z.object({ id: uuidSchema });
export const annotationAddPayloadSchema = z.object({ annotation: annotationIdPayloadSchema });
export const presenceJoinSchema = z.object({ newPresences: z.array(cursorPayloadSchema).max(MAX_PEERS) });
export const presenceLeaveSchema = z.object({ leftPresences: z.array(cursorPayloadSchema).max(MAX_PEERS) });
export const annotationInputSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('draw'), data: z.object({ points: pointPathSchema, width: widthSchema, color: colorSchema.optional() }) }),
  z.object({ type: z.literal('text'), data: z.object({ x: coordinateSchema, y: coordinateSchema, text: z.string().max(2000) }) }),
  z.object({ type: z.literal('marker'), data: z.object({ x: coordinateSchema, y: coordinateSchema, label: z.string().max(200).optional() }) }),
]);
const annotationRowSchema = z.object({
  id: uuidSchema, workspace_id: uuidSchema, user_id: uuidSchema,
  user_name: displayNameSchema, user_color: colorSchema,
  created_at: z.string().datetime({ offset: true }),
}).and(annotationInputSchema);
export function parseAnnotationRow(value: unknown, workspaceId?: string): StoredAnnotation | null {
  const parsed = annotationRowSchema.safeParse(value);
  if (!parsed.success || (workspaceId && parsed.data.workspace_id !== workspaceId)) return null;
  const row = parsed.data;
  return { id: row.id, userId: row.user_id, userName: row.user_name, userColor: row.user_color, type: row.type, data: row.data, createdAt: row.created_at };
}

const shortText = z.string().max(1000);
const paragraph = z.string().max(12_000);
const latLng = z.tuple([z.number().finite().min(-90).max(90), z.number().finite().min(-180).max(180)]);
const boxCoordinate = z.number().finite().min(0).max(1000);
// Strip unknown keys and bound every nested collection before values reach report components.
export const storedAnalysisSchema = z.object({
  title: z.string().min(1).max(500), confidence_score: z.number().finite().min(0).max(100),
  origin: z.object({ region: shortText, culture: shortText }),
  dating: z.object({ period: shortText, date_range: shortText, century: shortText }),
  specs: z.object({ style: shortText, material: shortText, technique: shortText, dimensions: shortText }),
  analysis: z.object({ description: paragraph, iconography: paragraph, inscription: z.object({ original: paragraph, translation: paragraph, notes: paragraph }).nullable() }),
  preservation: z.object({ condition: shortText, damages: paragraph }),
  fun_fact: paragraph, curator_note: paragraph,
  location: shortText.optional(),
  groundingUrls: z.array(z.object({ title: shortText, uri: z.string().max(2048) })).max(20).optional(),
  historical_context: paragraph.optional(), cultural_significance: paragraph.optional(),
  similar_artifacts: z.array(z.object({ name: shortText, museum: shortText, similarity: shortText })).max(50).optional(),
  production_technique_detail: paragraph.optional(), symbolism: paragraph.optional(), coordinates: latLng.optional(),
  current_location: z.object({ museum: shortText, city: shortText, country: shortText, coordinates: latLng }).optional(),
  bounding_boxes: z.array(z.object({ label: shortText, description: shortText, box_2d: z.tuple([boxCoordinate,boxCoordinate,boxCoordinate,boxCoordinate]) })).max(100).optional(),
  digital_reconstruction: paragraph.optional(),
  inventory: z.object({ type: shortText, period: shortText, material: shortText, condition: shortText, dimensions_estimate: shortText, preservation_recommendation: paragraph, catalog_id_suggestion: shortText }).optional(),
});
export const workspaceRowSchema = z.object({ id: uuidSchema, owner_id: uuidSchema, title: z.string().max(500), result_json: storedAnalysisSchema, image_url: z.string().max(3_000_000).nullable().optional(), created_at: z.string().datetime({ offset: true }) });
export function parseStoredAnalysis(value: unknown): AnalysisResult | null {
  const result = storedAnalysisSchema.safeParse(value);
  return result.success ? result.data as AnalysisResult : null;
}
export function peerDisplayName(value: unknown, fallback = 'Participant') {
  const parsed = displayNameSchema.safeParse(value);
  return parsed.success ? parsed.data : fallback;
}
/** Per-channel budget, independent of the unverified sender ID claimed by a peer. */
export function createEventBudget(limit: number, windowMs = 1000) {
  let start = 0, used = 0;
  return () => {
    const now = Date.now();
    if (now - start >= windowMs) { start = now; used = 0; }
    if (used >= limit) return false;
    used++; return true;
  };
}
