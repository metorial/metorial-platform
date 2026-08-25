import { describe, expect, it } from 'vitest';
import {
  doesUploadedObjectMatch,
  isValidDirectUploadSize,
  isValidUploadSize,
  maxDirectUploadSize,
  maxUploadSize
} from './uploadPolicy';

describe('upload size policy', () => {
  it('caps presigned uploads at 100 MiB and direct uploads at 50 MiB', () => {
    expect(maxUploadSize).toBe(100 * 1024 * 1024);
    expect(maxDirectUploadSize).toBe(50 * 1024 * 1024);
  });

  it('accepts positive integers up to the maximum', () => {
    expect(isValidUploadSize(1)).toBe(true);
    expect(isValidUploadSize(maxUploadSize)).toBe(true);
    expect(isValidDirectUploadSize(1)).toBe(true);
    expect(isValidDirectUploadSize(maxDirectUploadSize)).toBe(true);
  });

  it('rejects empty, oversized and non-integer sizes', () => {
    expect(isValidUploadSize(0)).toBe(false);
    expect(isValidUploadSize(-1)).toBe(false);
    expect(isValidUploadSize(maxUploadSize + 1)).toBe(false);
    expect(isValidUploadSize(1.5)).toBe(false);
    expect(isValidUploadSize(Number.NaN)).toBe(false);
    expect(isValidUploadSize(Number.POSITIVE_INFINITY)).toBe(false);
  });

  it('rejects direct uploads above the smaller direct limit', () => {
    expect(isValidDirectUploadSize(maxDirectUploadSize + 1)).toBe(false);
    expect(isValidDirectUploadSize(maxUploadSize)).toBe(false);
    expect(isValidDirectUploadSize(0)).toBe(false);
  });
});

describe('uploaded object verification', () => {
  it('requires the stored object to match the declared size exactly', () => {
    expect(doesUploadedObjectMatch({ declaredSize: 100, actualSize: 100 })).toBe(true);
    expect(doesUploadedObjectMatch({ declaredSize: 100, actualSize: 99 })).toBe(false);
    expect(doesUploadedObjectMatch({ declaredSize: 100, actualSize: 101 })).toBe(false);
  });
});
