import { safeImageSource } from './safeHtml';

/** Updating an artifact also updates its bytes; never reuse the previous artifact's image. */
export function artifactImageState(value: string | null) {
  const image = value?.startsWith('blob:') ? safeImageSource(value) || null : safeImageSource(value) || null;
  const match = image?.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+=*)$/);
  const bounded = match && match[2].length <= Math.ceil(2 * 1024 * 1024 / 3) * 4;
  return { image, imageBase64: bounded ? match[2] : null, imageMimeType: bounded ? match[1] : 'image/jpeg' };
}
