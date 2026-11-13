import { base62 } from '@lowerdeck/base62';
import { Hash } from '@lowerdeck/hash';
import type { CredentialKind } from '@metorial/groundstation-spec';
import { timingSafeEqual } from 'node:crypto';

let credentialPrefixes: Record<CredentialKind, string> = {
  token: 'metorial_agit',
  source: 'metorial_agis'
};
let prefixBytes = 16;
let secretBytes = 32;

let credentialPattern = /^metorial_agi([ts])_([0-9A-Za-z]{8,32})_([0-9A-Za-z]{32,96})$/;

export type ParsedIngestCredential = {
  kind: CredentialKind;
  prefix: string;
  secret: string;
};

let randomBase62 = (bytes: number) =>
  base62.encode(crypto.getRandomValues(new Uint8Array(bytes)));

export let generateIngestCredential = (kind: CredentialKind) => {
  let prefix = randomBase62(prefixBytes);
  let secret = randomBase62(secretBytes);

  return { prefix, secret, token: `${credentialPrefixes[kind]}_${prefix}_${secret}` };
};

export let generateIngestToken = () => generateIngestCredential('token');

export let generateIngestSourceSecret = () => generateIngestCredential('source');

export let parseIngestCredential = (credential: string): ParsedIngestCredential | null => {
  let match = credentialPattern.exec(credential);
  if (!match) return null;

  return {
    kind: match[1] == 's' ? 'source' : 'token',
    prefix: match[2]!,
    secret: match[3]!
  };
};

export let hashIngestTokenSecret = (secret: string) => Hash.sha256(secret);

export let secretHashesMatch = (a: string, b: string) => {
  let left = Buffer.from(a);
  let right = Buffer.from(b);

  return left.length == right.length && timingSafeEqual(left, right);
};
