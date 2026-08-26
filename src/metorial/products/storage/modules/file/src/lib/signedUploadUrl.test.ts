import { describe, expect, it } from 'vitest';
import {
  base62Decode,
  base62Encode,
  getCloudFrontUploadUrl,
  signUploadToken,
  uploadTokenPrefix,
  verifyUploadToken,
  type SignedUploadTokenPayload
} from './signedUploadUrl';

let secret = 'test-upload-hmac-secret';
let payload: SignedUploadTokenPayload = {
  u: 'fup_1',
  k: 'storekey20characters',
  e: Date.now() + 15 * 60 * 1000,
  s: 1024,
  c: 'image/png',
  m: ['PUT']
};

describe('base62', () => {
  it('round-trips bytes including leading zeros', () => {
    let bytes = Buffer.from([0, 0, 1, 255, 10]);
    expect(Buffer.from(base62Decode(base62Encode(bytes)))).toEqual(bytes);
  });

  it('uses the 0-9A-Za-z alphabet', () => {
    expect(base62Encode(Buffer.from('hello'))).toMatch(/^[0-9A-Za-z]+$/);
  });
});

describe('upload tokens', () => {
  it('signs with the fup_tok_ prefix and a trailing signature', () => {
    let token = signUploadToken({ secret, payload });
    expect(token.startsWith(uploadTokenPrefix)).toBe(true);
    expect(token.slice(uploadTokenPrefix.length).includes('_')).toBe(true);
  });

  it('verifies a token it just signed', () => {
    let token = signUploadToken({ secret, payload });
    expect(verifyUploadToken({ secret, token })).toEqual(payload);
  });

  it('rejects a token signed with a different secret', () => {
    let token = signUploadToken({ secret, payload });
    expect(verifyUploadToken({ secret: 'other', token })).toBeNull();
  });

  it('rejects a truncated token', () => {
    expect(verifyUploadToken({ secret, token: uploadTokenPrefix })).toBeNull();
    expect(verifyUploadToken({ secret, token: 'nope' })).toBeNull();
  });

  it('builds a CloudFront upload URL from the host and token', () => {
    let url = getCloudFrontUploadUrl({
      host: 'https://upload-us1.metorial.com/',
      secret,
      uploadId: payload.u,
      storeId: payload.k,
      size: payload.s,
      contentType: payload.c,
      expiresAt: new Date(payload.e)
    });
    expect(url.startsWith('https://upload-us1.metorial.com/fup_tok_')).toBe(true);
    let token = url.slice('https://upload-us1.metorial.com/'.length);
    expect(verifyUploadToken({ secret, token })).toMatchObject({
      u: payload.u,
      k: payload.k,
      s: payload.s,
      c: payload.c,
      m: ['PUT']
    });
  });
});
