import { describe, expect, it } from 'vitest';
import {
  getImageMimeType,
  IMAGE_PREVIEW_LIMIT,
  looksLikeText,
  planPreview,
  TEXT_FULL_READ_LIMIT
} from './preview';

let bytes = (...values: number[]) => new Uint8Array(values);

describe('getImageMimeType', () => {
  it('maps image extensions', () => {
    expect(getImageMimeType('/a/logo.PNG')).toBe('image/png');
    expect(getImageMimeType('/a/icon.svg')).toBe('image/svg+xml');
    expect(getImageMimeType('/a/readme.md')).toBeNull();
  });
});

describe('looksLikeText', () => {
  it('accepts utf-8 text, including multi-byte characters', () => {
    expect(looksLikeText(new TextEncoder().encode('héllo wörld ✓'))).toBe(true);
  });

  it('rejects data containing NUL bytes', () => {
    expect(looksLikeText(bytes(0x68, 0x00, 0x69))).toBe(false);
  });

  it('rejects invalid utf-8', () => {
    expect(looksLikeText(bytes(0xff, 0xfe, 0xfd))).toBe(false);
  });

  it('tolerates a multi-byte character cut off at the sample boundary', () => {
    let truncated = new TextEncoder().encode('é').subarray(0, 1);

    expect(looksLikeText(truncated)).toBe(true);
  });
});

describe('planPreview', () => {
  it('previews small images inline', () => {
    expect(planPreview({ path: '/a/b.png', size: 1000 })).toEqual({
      kind: 'image',
      mimeType: 'image/png'
    });
  });

  it('refuses images above the limit', () => {
    expect(planPreview({ path: '/a/b.png', size: IMAGE_PREVIEW_LIMIT + 1 })).toEqual({
      kind: 'unsupported',
      reason: 'image-too-large'
    });
  });

  it('reads small text files fully', () => {
    expect(planPreview({ path: '/a/b.ts', size: 100 })).toEqual({
      kind: 'text',
      partial: false
    });
    expect(planPreview({ path: '/a/b.ts', size: TEXT_FULL_READ_LIMIT })).toEqual({
      kind: 'text',
      partial: false
    });
  });

  it('reads large text files in ranges', () => {
    expect(planPreview({ path: '/a/b.log', size: TEXT_FULL_READ_LIMIT + 1 })).toEqual({
      kind: 'text',
      partial: true
    });
  });

  it('does not preview directories or special files', () => {
    expect(planPreview({ path: '/a', size: 0, type: 'directory' })).toEqual({
      kind: 'unsupported',
      reason: 'not-file'
    });

    expect(planPreview({ path: '/dev/null', size: 0, type: 'other' })).toEqual({
      kind: 'unsupported',
      reason: 'not-file'
    });
  });
});
