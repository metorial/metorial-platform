import { canonicalize } from '@lowerdeck/canonicalize';

export type SigningPublicKey = { kty: 'OKP'; crv: 'Ed25519'; x: string };

export type SigningPrivateKey = SigningPublicKey & { d: string };

export type SlateVersionStatement = {
  identifier: string;
  version: string;
  contentChecksum: string;
};

export type SlateVersionSignatureInput = { kid: string; signature: string };

export let slateVersionSignaturePrefix = 'metorial-slate-version/v1\n';

export let slatePackManifestSignaturePrefix = 'metorial-slatepack-manifest/v1\n';

export let contentChecksumAlgorithm = 'paths-bytes-sha256/v1';

let keyPattern = /^[A-Za-z0-9_-]{43}$/;

let encoder = new TextEncoder();

let toBase64Url = (bytes: Uint8Array | ArrayBuffer) =>
  Buffer.from(bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes).toString(
    'base64url'
  );

let fromBase64Url = (value: string) => new Uint8Array(Buffer.from(value, 'base64url'));

export let normalizeSlateIdentifier = (identifier: string) => identifier.replace(/^@/, '');

export let parseSigningPublicKey = (input: unknown): SigningPublicKey | null => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;

  let key = input as Record<string, unknown>;
  if (key.kty !== 'OKP' || key.crv !== 'Ed25519') return null;
  if (typeof key.x !== 'string' || !keyPattern.test(key.x)) return null;

  return { kty: 'OKP', crv: 'Ed25519', x: key.x };
};

export let getSigningKeyId = async (key: SigningPublicKey) => {
  let digest = await crypto.subtle.digest(
    'SHA-256',
    encoder.encode(canonicalize({ crv: key.crv, kty: key.kty, x: key.x }))
  );

  return toBase64Url(digest);
};

export let generateSigningKeyPair = async () => {
  let pair = (await crypto.subtle.generateKey('Ed25519', true, [
    'sign',
    'verify'
  ])) as CryptoKeyPair;
  let jwk = await crypto.subtle.exportKey('jwk', pair.privateKey);

  let publicKey: SigningPublicKey = { kty: 'OKP', crv: 'Ed25519', x: jwk.x! };
  let privateKey: SigningPrivateKey = { ...publicKey, d: jwk.d! };

  return { publicKey, privateKey, kid: await getSigningKeyId(publicKey) };
};

export let buildSlateVersionSigningInput = (statement: SlateVersionStatement) =>
  encoder.encode(
    slateVersionSignaturePrefix +
      canonicalize({
        type: 'slate_version',
        identifier: normalizeSlateIdentifier(statement.identifier),
        version: statement.version,
        contentChecksum: statement.contentChecksum,
        checksumAlgorithm: contentChecksumAlgorithm
      })
  );

let signBytes = async (privateKey: SigningPrivateKey, input: Uint8Array<ArrayBuffer>) => {
  let key = await crypto.subtle.importKey(
    'jwk',
    { kty: privateKey.kty, crv: privateKey.crv, x: privateKey.x, d: privateKey.d },
    'Ed25519',
    false,
    ['sign']
  );

  return toBase64Url(await crypto.subtle.sign('Ed25519', key, input));
};

let verifyBytes = async (
  publicKey: SigningPublicKey,
  signature: string,
  input: Uint8Array<ArrayBuffer>
) => {
  try {
    let key = await crypto.subtle.importKey(
      'jwk',
      { kty: publicKey.kty, crv: publicKey.crv, x: publicKey.x },
      'Ed25519',
      false,
      ['verify']
    );

    return await crypto.subtle.verify('Ed25519', key, fromBase64Url(signature), input);
  } catch {
    return false;
  }
};

let findValidSignature = async (d: {
  input: Uint8Array<ArrayBuffer>;
  signatures: SlateVersionSignatureInput[];
  trustedKeys: Map<string, SigningPublicKey>;
}) => {
  for (let signature of d.signatures) {
    let publicKey = d.trustedKeys.get(signature.kid);
    if (!publicKey) continue;

    if (await verifyBytes(publicKey, signature.signature, d.input)) return signature.kid;
  }

  return null;
};

export let signSlateVersion = async (d: {
  privateKey: SigningPrivateKey;
  statement: SlateVersionStatement;
}) => signBytes(d.privateKey, buildSlateVersionSigningInput(d.statement));

export let verifySlateVersionSignature = async (d: {
  publicKey: SigningPublicKey;
  signature: string;
  statement: SlateVersionStatement;
}) => verifyBytes(d.publicKey, d.signature, buildSlateVersionSigningInput(d.statement));

export let findValidSlateVersionSignature = async (d: {
  statement: SlateVersionStatement;
  signatures: SlateVersionSignatureInput[];
  trustedKeys: Map<string, SigningPublicKey>;
}) =>
  findValidSignature({
    input: buildSlateVersionSigningInput(d.statement),
    signatures: d.signatures,
    trustedKeys: d.trustedKeys
  });

// The manifest is signed byte for byte, so it must be stored exactly as it was signed.
export let buildSlatePackManifestSigningInput = (manifest: Uint8Array) => {
  let prefix = encoder.encode(slatePackManifestSignaturePrefix);
  let input = new Uint8Array(prefix.byteLength + manifest.byteLength);

  input.set(prefix, 0);
  input.set(manifest, prefix.byteLength);

  return input;
};

export let signSlatePackManifest = async (d: {
  privateKey: SigningPrivateKey;
  manifest: Uint8Array;
}) => signBytes(d.privateKey, buildSlatePackManifestSigningInput(d.manifest));

export let findValidSlatePackManifestSignature = async (d: {
  manifest: Uint8Array;
  signatures: SlateVersionSignatureInput[];
  trustedKeys: Map<string, SigningPublicKey>;
}) =>
  findValidSignature({
    input: buildSlatePackManifestSigningInput(d.manifest),
    signatures: d.signatures,
    trustedKeys: d.trustedKeys
  });
