import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';

let keyCacheSize = 1024;
let ivBytes = 12;
let tagBytes = 16;
let algorithm = 'aes-256-gcm' as const;

export type ContentKey = { organizationId: string; version: number; key: Buffer };

export type EncryptedText = { iv: Buffer; ciphertext: Buffer };

export type ContentCipher = {
  forOrganization: (organization: { id: string; contentKeyVersion: number }) => ContentKey;
  encrypt: (key: ContentKey, text: string, aad: string) => EncryptedText;
  decrypt: (key: ContentKey, encrypted: EncryptedText, aad: string) => string;
};

export let contentAad = (d: {
  organizationId: string;
  recordId: string;
  index: number;
  role: string;
}) => `${d.organizationId}\0${d.recordId}\0${d.index}\0${d.role}`;

export let createContentCipher = (secret: string): ContentCipher => {
  let cache = new Map<string, ContentKey>();

  return {
    forOrganization: organization => {
      let cacheKey = `${organization.contentKeyVersion}\0${organization.id}`;
      let cached = cache.get(cacheKey);

      if (cached) return cached;

      let derived: ContentKey = {
        organizationId: organization.id,
        version: organization.contentKeyVersion,
        key: Buffer.from(
          hkdfSync(
            'sha256',
            secret,
            'agent-tracking/content-key',
            `v${organization.contentKeyVersion}/${organization.id}`,
            32
          )
        )
      };

      if (cache.size >= keyCacheSize) {
        let oldest = cache.keys().next().value;
        if (oldest !== undefined) cache.delete(oldest);
      }

      cache.set(cacheKey, derived);

      return derived;
    },

    encrypt: (key, text, aad) => {
      let iv = randomBytes(ivBytes);
      let cipher = createCipheriv(algorithm, key.key, iv, { authTagLength: tagBytes });

      cipher.setAAD(Buffer.from(aad));

      let ciphertext = Buffer.concat([
        cipher.update(text, 'utf8'),
        cipher.final(),
        cipher.getAuthTag()
      ]);

      return { iv, ciphertext };
    },

    decrypt: (key, encrypted, aad) => {
      let body = encrypted.ciphertext.subarray(0, encrypted.ciphertext.length - tagBytes);
      let tag = encrypted.ciphertext.subarray(encrypted.ciphertext.length - tagBytes);

      let decipher = createDecipheriv(algorithm, key.key, encrypted.iv, {
        authTagLength: tagBytes
      });

      decipher.setAAD(Buffer.from(aad));
      decipher.setAuthTag(tag);

      return Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8');
    }
  };
};
