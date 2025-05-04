import { base62 } from '@metorial/base62';

export let shadowId = (
  prefix: string,
  otherIds: string[],
  otherStrings: (string | number | bigint | Date)[] = []
) => {
  let time = otherIds[0]?.split('_')[1].substring(0, 9) ?? '';
  let value = prefix + otherIds.join('') + otherStrings.join('');

  return (
    prefix +
    time +
    base62
      // @ts-ignore
      .encode(new Bun.CryptoHasher('sha256').update(value).digest() as Uint8Array)
      .slice(0, time.length ? 11 : 20)
  );
};
