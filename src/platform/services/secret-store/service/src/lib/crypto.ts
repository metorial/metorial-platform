import { canonicalize } from '@lowerdeck/canonicalize';
import { createCipheriv, createDecipheriv, createHash, timingSafeEqual } from 'crypto';

export let sha256Hex = (input: string | Uint8Array) =>
  createHash('sha256').update(input).digest('hex');

export let sha512Hex = (input: string | Uint8Array) =>
  createHash('sha512').update(input).digest('hex');

export let deriveSha256Key = (secret: string) =>
  createHash('sha256').update(secret, 'utf8').digest();

export let canonicalJson = (input: any) => canonicalize(input ?? null);

export let constantTimeEqual = (left: string, right: string) => {
  let leftBuffer = Buffer.from(left);
  let rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
};

export let encryptAes256Gcm = (d: {
  key: Uint8Array;
  plaintext: Uint8Array;
  aad?: Uint8Array;
}) => {
  let iv = crypto.getRandomValues(new Uint8Array(12));
  let cipher = createCipheriv('aes-256-gcm', Buffer.from(d.key), Buffer.from(iv));
  if (d.aad) cipher.setAAD(Buffer.from(d.aad));

  let ciphertext = Buffer.concat([cipher.update(Buffer.from(d.plaintext)), cipher.final()]);
  let authTag = cipher.getAuthTag();

  return {
    iv,
    ciphertext,
    authTag
  };
};

export let decryptAes256Gcm = (d: {
  key: Uint8Array;
  iv: Uint8Array;
  ciphertext: Uint8Array;
  authTag: Uint8Array;
  aad?: Uint8Array;
}) => {
  let decipher = createDecipheriv('aes-256-gcm', Buffer.from(d.key), Buffer.from(d.iv));
  if (d.aad) decipher.setAAD(Buffer.from(d.aad));
  decipher.setAuthTag(Buffer.from(d.authTag));

  return Buffer.concat([decipher.update(Buffer.from(d.ciphertext)), decipher.final()]);
};

export let zeroBuffer = (buffer: Uint8Array) => {
  buffer.fill(0);
};
