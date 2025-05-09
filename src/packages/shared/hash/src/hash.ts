import { base62 } from '@metorial/base62';

let _hash = async (algorithm: any, data: string) => {
  return base62.encode(
    new Uint8Array(await crypto.subtle.digest(algorithm, new TextEncoder().encode(data)))
  );
};

export let Hash = {
  sha1: async (data: string) => _hash('SHA-1', data),
  sha256: async (data: string) => _hash('SHA-256', data),
  sha384: async (data: string) => _hash('SHA-384', data),
  sha512: async (data: string) => _hash('SHA-512', data)
};
