import { describe, expect, test } from 'vitest';
import { Hash } from './hash';

describe('hash', () => {
  test('sha1', async () => {
    let hashed = await Hash.sha1('test');
    expect(typeof hashed).toBe('string');
    expect(hashed).toBe('o9Crlt3rLRVUnCwprCtih1kVEj1');
  });

  test('sha256', async () => {
    let hashed = await Hash.sha256('test');
    expect(typeof hashed).toBe('string');
    expect(hashed).toBe('BPnqohXkV2RYnNLSg67Oz0flm9eNJx2THIK59ZRZHV6');
  });
});
