import { describe, expect, it, vi } from 'vitest';

let maxBodySize = 100 * 1024 * 1024 + 1024 * 1024;

vi.mock('@metorial/module-file', () => ({
  maxDirectUploadBodySize: 100 * 1024 * 1024 + 1024 * 1024,
  maxDirectUploadSize: 100 * 1024 * 1024,
  formatByteSize: (bytes: number) => `${bytes} bytes`,
  useUploadUrlHint: 'hint'
}));

import { assertDirectUploadBodySize, parseStoreReplace } from './uploadForm';

describe('direct upload body size guard', () => {
  it('allows bodies up to the limit', () => {
    expect(() => assertDirectUploadBodySize('1')).not.toThrow();
    expect(() => assertDirectUploadBodySize(String(maxBodySize))).not.toThrow();
  });

  it('rejects bodies above the limit', () => {
    expect(() => assertDirectUploadBodySize(String(maxBodySize + 1))).toThrow(
      /can be at most/
    );
  });

  it('defers to the per-file check when the length is missing or unusable', () => {
    expect(() => assertDirectUploadBodySize(undefined)).not.toThrow();
    expect(() => assertDirectUploadBodySize('')).not.toThrow();
    expect(() => assertDirectUploadBodySize('not-a-number')).not.toThrow();
  });
});

describe('store_replace upload field', () => {
  it('defaults to false and accepts explicit booleans', () => {
    expect(parseStoreReplace(null, false)).toBe(false);
    expect(parseStoreReplace('false', true)).toBe(false);
    expect(parseStoreReplace('true', true)).toBe(true);
  });

  it('requires a linked store for replace mode', () => {
    expect(() => parseStoreReplace('true', false)).toThrow(/requires store_id and path/);
  });

  it('rejects invalid boolean values', () => {
    expect(() => parseStoreReplace('1', true)).toThrow(/must be true or false/);
  });
});
