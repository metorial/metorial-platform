// Regenerates testdata/vectors.json from the TypeScript reference implementations:
//   bun interop/vectors.ts
import {
  createEd25519RpcSignatureHeader,
  createRpcSignatureHeader
} from '../../../packages/rpc-signature/src/index.ts';
import { serialize } from '../../../packages/serialize/src/index.ts';

let d = (ms: number) => new Date(ms);

let serializeCases: { name: string; value: any; plain: string }[] = [
  {
    name: 'object with annotations',
    value: { a: 1, d: d(0), n: { e: d(1), u: undefined }, arr: [d(2), 1], b: 10n },
    plain:
      '{"a":1,"arr":["1970-01-01T00:00:00.002Z",1],"b":10,"d":"1970-01-01T00:00:00.000Z","n":{"e":"1970-01-01T00:00:00.001Z"}}'
  },
  { name: 'top-level array', value: [1, d(0)], plain: '[1,"1970-01-01T00:00:00.000Z"]' },
  { name: 'top-level string', value: 'hi', plain: '"hi"' },
  { name: 'top-level number', value: 5, plain: '5' },
  { name: 'top-level date', value: d(0), plain: '"1970-01-01T00:00:00.000Z"' },
  { name: 'top-level null', value: null, plain: '{}' },
  { name: 'top-level undefined', value: undefined, plain: 'null' },
  { name: 'empty object', value: {}, plain: '{}' },
  {
    name: 'map with dates',
    value: { m: new Map([['a', d(0)]]) },
    plain: '{"m":{"a":"1970-01-01T00:00:00.000Z"}}'
  },
  {
    name: 'set with dates',
    value: { s: new Set([d(0)]) },
    plain: '{"s":["1970-01-01T00:00:00.000Z"]}'
  },
  {
    name: 'escaped keys',
    value: { 'a.b': d(0), 'x\\y': { '1.2': 10n } },
    plain: '{"a.b":"1970-01-01T00:00:00.000Z","x\\\\y":{"1.2":10}}'
  },
  {
    name: 'batch envelope',
    value: { calls: [{ id: 'call_1', name: 'bucket:get', payload: { at: d(0) } }] },
    plain:
      '{"calls":[{"id":"call_1","name":"bucket:get","payload":{"at":"1970-01-01T00:00:00.000Z"}}]}'
  }
];

let hmac = {
  token: 'shared-secret',
  timestamp: 1_700_000_000_000,
  method: 'POST',
  url: 'https://svc.internal/rpc/bucket.get?region=eu&x=1',
  body: '{"$$TYPES$$":{"__mode":"object"},"bucketId":"bkt_1"}'
};

let keyPair = (await crypto.subtle.generateKey('Ed25519', true, [
  'sign',
  'verify'
])) as CryptoKeyPair;
let privateJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);
let publicJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);

let ed25519 = {
  privateJwk,
  publicJwk,
  keyId: 'svc-a.key-1',
  audience: 'code-bucket',
  timestamp: 1_700_000_000_000,
  nonce: 'abcdefghijklmnopqrstuvwxyzABCDEF',
  method: 'POST',
  url: 'https://svc.internal/rpc?a=1&b=%3C2%3E',
  authorization: 'Bearer token-1',
  body: hmac.body
};

let vectors = {
  serialize: serializeCases.map(c => ({
    name: c.name,
    encoded: serialize.encode(c.value),
    plain: c.plain
  })),
  hmac: { ...hmac, header: await createRpcSignatureHeader(hmac) },
  ed25519: {
    ...ed25519,
    header: await createEd25519RpcSignatureHeader({ ...ed25519, privateKey: privateJwk })
  }
};

await Bun.write(
  new URL('../testdata/vectors.json', import.meta.url),
  JSON.stringify(vectors, null, 2) + '\n'
);
