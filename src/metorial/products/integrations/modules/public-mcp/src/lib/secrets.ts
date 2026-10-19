import { Hash } from '@lowerdeck/hash';
import { randomBytes, timingSafeEqual } from 'node:crypto';

export let hashSecret = (value: string) => Hash.sha256(value);

export let generateSecret = (prefix: string) =>
  `${prefix}${randomBytes(32).toString('base64url')}`;

export let secretsEqual = (a: string, b: string) => {
  let left = Buffer.from(a);
  let right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};
