import { describe, expect, it } from 'vitest';
import {
  describeAccept,
  describeMaxSize,
  matchesAccept,
  splitFiles,
  toAcceptAttribute,
  validateFile
} from './accept';
import { formatFileSize } from './formatFileSize';

let makeFile = (name: string, size = 10, type = '') =>
  new File([new Uint8Array(size)], name, { type });

let archives = ['.zip', '.tar', '.tar.gz'];

describe('formatFileSize', () => {
  it('formats bytes with binary units', () => {
    expect(formatFileSize(0)).toBe('0 B');
    expect(formatFileSize(1023)).toBe('1023 B');
    expect(formatFileSize(1024)).toBe('1 KB');
    expect(formatFileSize(4300)).toBe('4.2 KB');
    expect(formatFileSize(50 * 1024 * 1024)).toBe('50 MB');
    expect(formatFileSize(12.4 * 1024 * 1024)).toBe('12.4 MB');
    expect(formatFileSize(3 * 1024 ** 4)).toBe('3 TB');
  });

  it('handles invalid values', () => {
    expect(formatFileSize(-1)).toBe('—');
    expect(formatFileSize(Number.NaN)).toBe('—');
  });
});

describe('matchesAccept', () => {
  it('accepts everything without patterns', () => {
    expect(matchesAccept(makeFile('a.bin'))).toBe(true);
    expect(matchesAccept(makeFile('a.bin'), [])).toBe(true);
  });

  it('matches multi-part extensions case-insensitively', () => {
    expect(matchesAccept(makeFile('ctx.TAR.GZ'), archives)).toBe(true);
    expect(matchesAccept(makeFile('ctx.zip'), archives)).toBe(true);
    expect(matchesAccept(makeFile('ctx.gz'), archives)).toBe(false);
    expect(matchesAccept(makeFile('.zip'), archives)).toBe(false);
  });

  it('matches exact and wildcard MIME types', () => {
    expect(matchesAccept(makeFile('a', 1, 'image/png'), ['image/*'])).toBe(true);
    expect(matchesAccept(makeFile('a', 1, 'application/zip'), ['application/zip'])).toBe(true);
    expect(matchesAccept(makeFile('a', 1, 'text/plain'), ['image/*'])).toBe(false);
  });
});

describe('accept descriptions', () => {
  it('lists extensions in prose', () => {
    expect(describeAccept(archives)).toBe('.zip, .tar or .tar.gz');
    expect(describeAccept(['.zip'])).toBe('.zip');
    expect(describeAccept(['image/*'])).toBe('image/*');
    expect(describeAccept()).toBeNull();
  });

  it('builds the input accept attribute', () => {
    expect(toAcceptAttribute(['.ZIP', 'image/*'])).toBe('.zip,image/*');
    expect(toAcceptAttribute([])).toBeUndefined();
  });

  it('describes the size limit', () => {
    expect(describeMaxSize(50 * 1024 * 1024)).toBe('Up to 50 MB');
    expect(describeMaxSize()).toBeNull();
  });
});

describe('validateFile', () => {
  it('rejects the wrong type with the allowed list', () => {
    let rejection = validateFile(makeFile('ctx.rar'), { accept: archives });

    expect(rejection?.reason).toBe('type');
    expect(rejection?.message).toBe(
      "ctx.rar isn't a supported file. Use .zip, .tar or .tar.gz."
    );
  });

  it('rejects oversized files with the limit', () => {
    let rejection = validateFile(makeFile('ctx.zip', 2048), {
      accept: archives,
      maxSize: 1024
    });

    expect(rejection?.reason).toBe('size');
    expect(rejection?.message).toBe('ctx.zip is 2 KB. Up to 1 KB.');
  });

  it('accepts valid files', () => {
    expect(
      validateFile(makeFile('ctx.zip', 10), { accept: archives, maxSize: 1024 })
    ).toBeNull();
  });
});

describe('splitFiles', () => {
  it('splits accepted and rejected files', () => {
    let good = makeFile('a.zip');
    let bad = makeFile('b.rar');
    let result = splitFiles([good, bad], { accept: archives, multiple: true });

    expect(result.accepted).toEqual([good]);
    expect(result.rejected.map(r => r.file)).toEqual([bad]);
  });

  it('rejects several files for a single-file input', () => {
    let result = splitFiles([makeFile('a.zip'), makeFile('b.zip')], { multiple: false });

    expect(result.accepted).toEqual([]);
    expect(result.rejected).toEqual([
      { file: null, reason: 'count', message: 'Choose one file.' }
    ]);
  });
});
