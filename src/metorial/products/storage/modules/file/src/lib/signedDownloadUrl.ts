import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Tokens } from '@lowerdeck/tokens';
import { env } from '../env';
import type { File } from '@metorial/db';

let signedDownloadTokenType = 'file_download';
let signedDownloadTokens = new Tokens({
  secret: env.service.SIGNED_DOWNLOAD_URL_TOKEN_SECRET
});

type SignedDownloadTokenData = {
  fileId: string;
  storeId: string;
};

let defaultExpirationMs = 3 * 24 * 60 * 60 * 1000;

let getExpirationDate = (expiresInSeconds?: number) =>
  new Date(Date.now() + (expiresInSeconds ? expiresInSeconds * 1000 : defaultExpirationMs));

let regionSuffix = `_${env.service.METORIAL_REGION ?? 'ext'}`;

export let createSignedFileDownloadKey = async (
  file: Pick<File, 'id' | 'storeId'>,
  opts?: { expiresInSeconds?: number }
) => {
  let token = await signedDownloadTokens.sign({
    type: signedDownloadTokenType,
    expiresAt: getExpirationDate(opts?.expiresInSeconds),
    data: {
      fileId: file.id,
      storeId: file.storeId
    } satisfies SignedDownloadTokenData
  });

  return token + regionSuffix;
};

export let getSignedFileDownloadUrl = async (
  file: Pick<File, 'id' | 'storeId'>,
  opts?: { expiresInSeconds?: number }
) => {
  if (!env.service.DOWNLOAD_PUBLIC_URL) return undefined;

  let key = await createSignedFileDownloadKey(file, opts);
  return `${env.service.DOWNLOAD_PUBLIC_URL.replace(/\/$/, '')}/files/${file.id}/${encodeURIComponent(key)}`;
};

export let getSignedFileDownloadUrlOrThrow = async (
  file: Pick<File, 'id' | 'storeId'>,
  opts?: { expiresInSeconds?: number }
) => {
  let url = await getSignedFileDownloadUrl(file, opts);
  if (!url) {
    throw new ServiceError(
      badRequestError({
        message: 'DOWNLOAD_PUBLIC_URL is not configured; cannot generate a signed file URL'
      })
    );
  }

  return url;
};

export let verifySignedFileDownloadKey = async (d: { fileId: string; key: string }) => {
  try {
    let token = d.key;

    if (token.endsWith(regionSuffix)) {
      token = token.slice(0, -regionSuffix.length);
    }

    let payload = await signedDownloadTokens.verify({
      token: token,
      expectedType: signedDownloadTokenType
    });

    if (!payload.verified) return null;

    let data = payload.data as Partial<SignedDownloadTokenData>;
    if (data.fileId !== d.fileId || typeof data.storeId !== 'string') return null;

    return {
      fileId: data.fileId,
      storeId: data.storeId
    };
  } catch {
    return null;
  }
};
