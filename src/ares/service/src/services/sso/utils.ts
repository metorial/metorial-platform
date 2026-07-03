import { createHash } from 'crypto';

export let uniqueValues = (values: string[]) => {
  let seen = new Set<string>();
  let out: string[] = [];

  for (let value of values.filter(Boolean)) {
    if (seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }

  return out;
};

export let hashUid = (uid: string) => createHash('sha256').update(uid).digest('hex');

export let isUniqueConstraintError = (error: unknown) => (error as any)?.code === 'P2002';
