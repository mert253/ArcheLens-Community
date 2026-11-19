/** Data URLs are the only durable museum media sources until trusted storage exists. */
export const MAX_MUSEUM_IMAGE_BYTES = 2 * 1024 * 1024;
export function normalizeStoredMuseumImage(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2796227) return null;
  const match = /^data:image\/(png|jpeg|webp);base64,((?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?)$/.exec(value);
  if (!match || match[0] !== value || !match[2]) return null;
  const kind = match[1];
  const payload = match[2];
  const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0;
  const size = payload.length * 3 / 4 - padding;
  if (size > MAX_MUSEUM_IMAGE_BYTES || size < 3) return null;
  try {
    const raw = atob(payload);
    if (raw.length !== size || btoa(raw) !== payload) return null;
    const byte = (n: number) => raw.charCodeAt(n);
    const valid = kind === 'png'
      ? raw.length >= 8 && [137,80,78,71,13,10,26,10].every((v,i) => byte(i) === v)
      : kind === 'jpeg'
        ? byte(0) === 255 && byte(1) === 216 && byte(2) === 255
        : raw.length >= 12 && raw.slice(0, 4) === 'RIFF' && raw.slice(8, 12) === 'WEBP';
    return valid ? value : null;
  } catch {
    return null;
  }
}
