import { env } from '../env';

export let rewriteObjectStorageUrl = (
  url: string,
  publicBase: string | undefined,
  internalBase: string | undefined
) => {
  if (!publicBase || !internalBase) return url;

  let from = publicBase.replace(/\/+$/, '');
  if (url != from && !url.startsWith(`${from}/`)) return url;

  return `${internalBase.replace(/\/+$/, '')}${url.slice(from.length)}`;
};

export let internalObjectStorageUrl = (url: string) =>
  rewriteObjectStorageUrl(
    url,
    env.storage.OBJECT_STORAGE_PUBLIC_URL,
    env.storage.OBJECT_STORAGE_PUBLIC_INTERNAL_URL
  );
