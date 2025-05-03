import { base62 } from '@metorial/base62';
import { generatePlainId } from '@metorial/id';

let importedKeys = new Map<string, CryptoKey>();
let importKey = async (keyStr: string) => {
  if (importedKeys.has(keyStr)) return importedKeys.get(keyStr)!;

  let encoder = new TextEncoder();
  let secretKeyData = encoder.encode(keyStr);
  let ck = await crypto.subtle.importKey(
    'raw',
    secretKeyData,
    { name: 'HMAC', hash: 'SHA-512' },
    true,
    ['sign', 'verify']
  );

  importedKeys.set(keyStr, ck);

  return ck;
};

let exp = {
  stringify: (expiry: number) => expiry.toString(36),
  parse: (expiry: string) => parseInt(expiry, 36)
};

let encode = (data: string) => new TextEncoder().encode(data);

export let signature = (opts: { prefix: string; expirationMs: number; key: string }) => ({
  sign: async ({
    data,
    expirationMs = opts.expirationMs
  }: {
    data: string;

    expirationMs?: number;
  }) => {
    let key = await importKey(opts.key);
    let expiry = Date.now() + expirationMs;

    let id = generatePlainId(10);

    let dataToAuthenticate = JSON.stringify([id, data, expiry]);
    let signature = await crypto.subtle.sign('HMAC', key, encode(dataToAuthenticate));

    let hmac = base62.encode(new Uint8Array(signature));

    return `${opts.prefix}${hmac}_${exp.stringify(expiry)}_${id}`;
  },

  verify: async ({
    data,
    signature,
    acceptExpired = false
  }: {
    data: string;
    signature: string;
    acceptExpired?: boolean;
  }) => {
    let key = await importKey(opts.key);

    let sigStr = signature.slice(opts.prefix.length);
    let [encodedHmac, expiry, id] = sigStr.split('_');

    let hmac = base62.decodeRaw(encodedHmac);

    let dataToAuthenticate = JSON.stringify([id, data, exp.parse(expiry)]);

    let isValid = await crypto.subtle.verify('HMAC', key, hmac, encode(dataToAuthenticate));

    if (!isValid) return false;
    if (acceptExpired) return true;

    return Date.now() < exp.parse(expiry);
  }
});

export let signatureBasic = {
  sign: async (data: string, key: string) => {
    let signature = await crypto.subtle.sign('HMAC', await importKey(key), encode(data));
    let hmac = base62.encode(new Uint8Array(signature));
    return hmac;
  },

  verify: async (data: string, signature: string, key: string) => {
    let hmac = base62.decodeRaw(signature);
    return crypto.subtle.verify('HMAC', await importKey(key), hmac, encode(data));
  }
};
