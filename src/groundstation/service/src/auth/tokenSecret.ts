import { base62 } from '@lowerdeck/base62';
import { Hash } from '@lowerdeck/hash';
import { timingSafeEqual } from 'node:crypto';

let tokenPrefix = 'gsk';
let prefixBytes = 8;
let secretBytes = 32;

let tokenPattern = /^gsk_([0-9A-Za-z]{8,24})_([0-9A-Za-z]{32,96})$/;

export type ParsedIngestToken = {
  prefix: string;
  secret: string;
};

let randomBase62 = (bytes: number) =>
  base62.encode(crypto.getRandomValues(new Uint8Array(bytes)));

export let generateIngestToken = () => {
  let prefix = randomBase62(prefixBytes);
  let secret = randomBase62(secretBytes);

  return { prefix, secret, token: `${tokenPrefix}_${prefix}_${secret}` };
};

export let parseIngestToken = (credential: string): ParsedIngestToken | null => {
  let match = tokenPattern.exec(credential);
  if (!match) return null;

  return { prefix: match[1]!, secret: match[2]! };
};

export let hashIngestTokenSecret = (secret: string) => Hash.sha256(secret);

export let secretHashesMatch = (a: string, b: string) => {
  let left = Buffer.from(a);
  let right = Buffer.from(b);

  return left.length == right.length && timingSafeEqual(left, right);
};
