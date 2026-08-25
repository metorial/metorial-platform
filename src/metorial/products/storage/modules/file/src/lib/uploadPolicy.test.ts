import { describe, expect, it } from 'vitest';
import {
  describeInvalidUploadSize,
  doesUploadedObjectMatch,
  formatByteSize,
  isValidDirectUploadSize,
  isValidUploadSize,
  maxDirectUploadSize,
  maxUploadSize
} from './uploadPolicy';

describe('byte size formatting', () => {
  it('uses the largest unit that keeps the number readable', () => {
    expect(formatByteSize(0)).toBe('0 bytes');
    expect(formatByteSize(512)).toBe('512 bytes');
    expect(formatByteSize(1024)).toBe('1 KB');
    expect(formatByteSize(maxDirectUploadSize)).toBe('100 MB');
    expect(formatByteSize(maxUploadSize)).toBe('2 GB');
    expect(formatByteSize(262_500_000)).toBe('250.3 MB');
    expect(formatByteSize(3 * 1024 ** 3)).toBe('3 GB');
  });
});

describe('invalid upload size messages', () => {
  it('names both the limit and the offending size', () => {
    expect(describeInvalidUploadSize({ size: 262_500_000, max: maxUploadSize })).toBe(
      'Files can be at most 2 GB, but this one is 250.3 MB.'
    );
  });

  it('explains what the field should hold when it is not a byte count', () => {
    for (let size of [undefined, null, 'huge', 0, -1, 1.5, Number.NaN]) {
      expect(describeInvalidUploadSize({ size, max: maxUploadSize })).toMatch(
        /whole number greater than zero/
      );
    }
  });
});

describe('upload size policy', () => {
  it('caps presigned uploads at 2 GiB and direct uploads at 100 MiB', () => {
    expect(maxUploadSize).toBe(2 * 1024 * 1024 * 1024);
    expect(maxDirectUploadSize).toBe(100 * 1024 * 1024);
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

  it('rejects sizes that are not numbers at all', () => {
    expect(isValidUploadSize(undefined)).toBe(false);
    expect(isValidUploadSize(null)).toBe(false);
    expect(isValidUploadSize('1024')).toBe(false);
  });
});

describe('uploaded object verification', () => {
  it('requires the stored object to match the declared size exactly', () => {
    expect(doesUploadedObjectMatch({ declaredSize: 100, actualSize: 100 })).toBe(true);
    expect(doesUploadedObjectMatch({ declaredSize: 100, actualSize: 99 })).toBe(false);
    expect(doesUploadedObjectMatch({ declaredSize: 100, actualSize: 101 })).toBe(false);
  });
});
