import { describe, expect, it } from 'vitest';
import {
  applyLineEnding,
  createTextChunkDecoder,
  decodeUtf8,
  detectLineEnding,
  encodeText,
  hasUtf8Bom,
  normalizeLineEndings
} from './text';

describe('line endings', () => {
  it('detects the dominant ending', () => {
    expect(detectLineEnding('a\nb\nc')).toBe('lf');
    expect(detectLineEnding('a\r\nb\r\nc')).toBe('crlf');
    expect(detectLineEnding('a\r\nb\nc\nd')).toBe('lf');
    expect(detectLineEnding('no newline')).toBe('lf');
  });

  it('normalizes carriage returns', () => {
    expect(normalizeLineEndings('a\r\nb\rc\nd')).toBe('a\nb\nc\nd');
  });

  it('applies the requested ending', () => {
    expect(applyLineEnding('a\nb\r\nc', 'crlf')).toBe('a\r\nb\r\nc');
    expect(applyLineEnding('a\r\nb', 'lf')).toBe('a\nb');
  });
});

describe('utf-8 handling', () => {
  it('detects a byte order mark', () => {
    expect(hasUtf8Bom(new Uint8Array([0xef, 0xbb, 0xbf, 0x61]))).toBe(true);
    expect(hasUtf8Bom(new Uint8Array([0x61, 0x62, 0x63]))).toBe(false);
    expect(hasUtf8Bom(new Uint8Array([0xef, 0xbb]))).toBe(false);
  });

  it('strips the BOM when decoding and restores it when encoding', () => {
    let original = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode('hi')]);

    expect(decodeUtf8(original)).toBe('hi');
    expect(Array.from(encodeText('hi', { lineEnding: 'lf', bom: true }))).toEqual(
      Array.from(original)
    );
  });

  it('returns null for invalid utf-8', () => {
    expect(decodeUtf8(new Uint8Array([0xff, 0xfe]))).toBeNull();
  });

  it('round-trips CRLF text', () => {
    let bytes = encodeText('a\nb\n', { lineEnding: 'crlf', bom: false });

    expect(new TextDecoder().decode(bytes)).toBe('a\r\nb\r\n');
  });

  it('decodes characters split across chunks', () => {
    let encoded = new TextEncoder().encode('a✓b');
    let decoder = createTextChunkDecoder();

    let first = decoder.decode(encoded.subarray(0, 2), false);
    let second = decoder.decode(encoded.subarray(2), true);

    expect(first + second).toBe('a✓b');
  });

  it('throws on a truncated sequence in the final chunk', () => {
    let encoded = new TextEncoder().encode('✓');

    expect(() => createTextChunkDecoder().decode(encoded.subarray(0, 2), true)).toThrow();
  });
});
