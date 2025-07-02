import { base62 } from '@metorial/base62';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getSecretFingerprint } from '../src/lib/fingerprint';

// Mock Bun.SHA512
class MockSHA512 {
  private _data = '';
  update(data: string) {
    this._data = data;
    return this;
  }
  digest() {
    // Return a predictable Uint8Array for testing
    return new Uint8Array([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24,
      25, 26, 27, 28, 29, 30, 31, 32
    ]);
  }
}

vi.mock('@metorial/base62', () => ({
  base62: {
    encode: vi.fn((input: Uint8Array) => {
      // Return a string of 40 characters for slicing
      return 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMN0123456789';
    })
  }
}));

beforeEach(() => {
  // @ts-ignore
  global.Bun = { SHA512: MockSHA512 };
});

describe('getSecretFingerprint', () => {
  it('should return a fingerprint with the correct prefix and length', async () => {
    const organizationId = 'org123';
    const secret = 'supersecretvalue1234567890';
    const fingerprint = await getSecretFingerprint(organizationId, secret);

    expect(fingerprint.startsWith('mtsec*')).toBe(true);
    // The slice(10, 30) should give 20 chars after the prefix
    expect(fingerprint.length).toBe('mtsec*'.length + 20);
  });

  it('should call base62.encode with the hash', async () => {
    const organizationId = 'org456';
    const secret = 'anothersecretvalue0987654321';
    const encodeSpy = vi.spyOn(base62, 'encode');
    await getSecretFingerprint(organizationId, secret);
    expect(encodeSpy).toHaveBeenCalled();
    // The argument should be a Uint8Array
    expect(encodeSpy.mock.calls[0][0]).toBeInstanceOf(Uint8Array);
  });

  it('should use the correct parts of the secret for hashing', async () => {
    const organizationId = 'org789';
    const secret = 'abcdefghij1234567890klmnopqrstuv';
    let capturedData = '';
    class CustomSHA512 {
      update(data: string) {
        capturedData = data;
        return this;
      }
      digest() {
        return new Uint8Array(32);
      }
    }
    // @ts-ignore
    global.Bun = { SHA512: CustomSHA512 };
    await getSecretFingerprint(organizationId, secret);

    // Compute expected part1 and part2
    const mid = Math.floor(secret.length / 2);
    const part1 = secret.substring(4, mid - 3);
    const part2 = secret.substring(mid + 3, secret.length - 4);
    const expected = `${part2}${organizationId}${part1}`;
    expect(capturedData).toBe(expected);
  });

  it('should handle short secrets gracefully', async () => {
    const organizationId = 'orgShort';
    const secret = 'shortsec';
    const fingerprint = await getSecretFingerprint(organizationId, secret);
    expect(fingerprint.startsWith('mtsec*')).toBe(true);
    expect(fingerprint.length).toBe('mtsec*'.length + 20);
  });
});
