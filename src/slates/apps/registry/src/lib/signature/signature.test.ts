import { describe, expect, it } from 'bun:test';
import {
  findValidSlatePackManifestSignature,
  findValidSlateVersionSignature,
  generateSigningKeyPair,
  getSigningKeyId,
  parseSigningPublicKey,
  signSlatePackManifest,
  signSlateVersion,
  verifySlateVersionSignature
} from './index';

let statement = {
  identifier: 'metorial/example',
  version: '1.2.3',
  contentChecksum: `sha256:${'a'.repeat(64)}`
};

describe('slate version signatures', () => {
  it('derives a stable kid from the public key', async () => {
    let pair = await generateSigningKeyPair();

    expect(pair.kid).toBe(await getSigningKeyId(pair.publicKey));
    expect(pair.kid).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(parseSigningPublicKey(pair.publicKey)).toEqual(pair.publicKey);
  });

  it('verifies a signature over the same statement', async () => {
    let pair = await generateSigningKeyPair();
    let signature = await signSlateVersion({ privateKey: pair.privateKey, statement });

    expect(
      await verifySlateVersionSignature({ publicKey: pair.publicKey, signature, statement })
    ).toBe(true);
    expect(
      await verifySlateVersionSignature({
        publicKey: pair.publicKey,
        signature,
        statement: { ...statement, identifier: '@metorial/example' }
      })
    ).toBe(true);
  });

  it('rejects changed contents, versions and identifiers', async () => {
    let pair = await generateSigningKeyPair();
    let signature = await signSlateVersion({ privateKey: pair.privateKey, statement });

    for (let changed of [
      { ...statement, contentChecksum: `sha256:${'b'.repeat(64)}` },
      { ...statement, version: '1.2.4' },
      { ...statement, identifier: 'metorial/other' }
    ]) {
      expect(
        await verifySlateVersionSignature({
          publicKey: pair.publicKey,
          signature,
          statement: changed
        })
      ).toBe(false);
    }
  });

  it('accepts any trusted co-signature and ignores unknown keys', async () => {
    let oldKey = await generateSigningKeyPair();
    let newKey = await generateSigningKeyPair();
    let unknownKey = await generateSigningKeyPair();

    let signatures = await Promise.all(
      [unknownKey, oldKey, newKey].map(async key => ({
        kid: key.kid,
        signature: await signSlateVersion({ privateKey: key.privateKey, statement })
      }))
    );

    let onlyOld = new Map([[oldKey.kid, oldKey.publicKey]]);
    expect(
      await findValidSlateVersionSignature({ statement, signatures, trustedKeys: onlyOld })
    ).toBe(oldKey.kid);

    let none = new Map([[unknownKey.kid, newKey.publicKey]]);
    expect(
      await findValidSlateVersionSignature({ statement, signatures, trustedKeys: none })
    ).toBe(null);
  });

  it('rejects malformed public keys', () => {
    expect(parseSigningPublicKey({ kty: 'EC', crv: 'P-256', x: 'a'.repeat(43) })).toBe(null);
    expect(parseSigningPublicKey({ kty: 'OKP', crv: 'Ed25519', x: 'short' })).toBe(null);
    expect(parseSigningPublicKey(null)).toBe(null);
  });
});

describe('slate pack manifest signatures', () => {
  let manifest = new TextEncoder().encode('{"format":"metorial-slatepack","formatVersion":2}');

  it('accepts a signature from any trusted co-signer', async () => {
    let first = await generateSigningKeyPair();
    let second = await generateSigningKeyPair();
    let signatures = [
      {
        kid: first.kid,
        signature: await signSlatePackManifest({ privateKey: first.privateKey, manifest })
      },
      {
        kid: second.kid,
        signature: await signSlatePackManifest({ privateKey: second.privateKey, manifest })
      }
    ];

    expect(
      await findValidSlatePackManifestSignature({
        manifest,
        signatures,
        trustedKeys: new Map([[second.kid, second.publicKey]])
      })
    ).toBe(second.kid);
  });

  it('rejects changed manifest bytes and untrusted keys', async () => {
    let pair = await generateSigningKeyPair();
    let signatures = [
      {
        kid: pair.kid,
        signature: await signSlatePackManifest({ privateKey: pair.privateKey, manifest })
      }
    ];
    let changed = new TextEncoder().encode(
      '{"format":"metorial-slatepack","formatVersion":2} '
    );

    expect(
      await findValidSlatePackManifestSignature({
        manifest: changed,
        signatures,
        trustedKeys: new Map([[pair.kid, pair.publicKey]])
      })
    ).toBeNull();
    expect(
      await findValidSlatePackManifestSignature({
        manifest,
        signatures,
        trustedKeys: new Map()
      })
    ).toBeNull();
  });

  it('does not accept a slate version signature as a manifest signature', async () => {
    let pair = await generateSigningKeyPair();
    let signature = await signSlateVersion({ privateKey: pair.privateKey, statement });

    expect(
      await findValidSlatePackManifestSignature({
        manifest,
        signatures: [{ kid: pair.kid, signature }],
        trustedKeys: new Map([[pair.kid, pair.publicKey]])
      })
    ).toBeNull();
  });
});
