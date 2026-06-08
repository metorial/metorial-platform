import { base62 } from '@lowerdeck/base62';
import { createHash } from 'crypto';

export let shadowId = (
  prefix: string,
  otherIds: string[],
  otherStrings: (string | number | bigint | Date)[] = []
) => {
  let time = otherIds[0]?.split('_')[1].substring(0, 9) ?? '';
  let value = prefix + otherIds.join('') + otherStrings.join('');

  let hash = createHash('sha256').update(value).digest();

  return prefix + time + base62.encode(hash).slice(0, time.length ? 11 : 20);
};
