import { base62 } from '@metorial/base62';

export let getSecretFingerprint = async (organizationId: string, secret: string) => {
  // We really don't need the full secret for the fingerprint
  let part1 = secret.substring(4, Math.floor(secret.length / 2) - 3);
  let part2 = secret.substring(Math.floor(secret.length / 2) + 3, secret.length - 4);

  let secretToHash = `${part2}${organizationId}${part1}`;

  let hash = new Bun.SHA512().update(secretToHash).digest() as Uint8Array;

  return 'mtsec*' + base62.encode(hash).slice(10, 30);
};
