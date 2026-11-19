import { expect, it } from 'vitest';
import { artifactImageState } from './artifactImage';

it('loads the selected photo while clearing previously selected image bytes', () => {
  expect(artifactImageState('blob:https://example.invalid/id')).toEqual({ image: 'blob:https://example.invalid/id', imageBase64: null, imageMimeType: 'image/jpeg' });
  expect(artifactImageState('data:image/png;base64,iVBORw0KGgo=')).toEqual({ image: 'data:image/png;base64,iVBORw0KGgo=', imageBase64: 'iVBORw0KGgo=', imageMimeType: 'image/png' });
  expect(artifactImageState('data:image/svg+xml,<svg onload=alert(1)>')).toEqual({ image: null, imageBase64: null, imageMimeType: 'image/jpeg' });
});
