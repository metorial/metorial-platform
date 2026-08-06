import { Tokens } from '@lowerdeck/tokens';
import { env } from '@metorial/cargo-config';
import type { File } from '@metorial/db';

let signedDownloadTokenType = 'file_download';
let signedDownloadTokens = new Tokens({
  secret: env.service.SIGNED_DOWNLOAD_URL_TOKEN_SECRET
});

type SignedDownloadTokenData = {
  fileId: string;
  storeId: string;
};

let getExpirationDate = () => {
  let date = new Date();
  date.setDate(date.getDate() + 3);
  return date;
};

let regionSuffix = `_${env.service.METORIAL_REGION ?? 'ext'}`;

export let createSignedFileDownloadKey = async (file: Pick<File, 'id' | 'storeId'>) => {
  let token = await signedDownloadTokens.sign({
    type: signedDownloadTokenType,
    expiresAt: getExpirationDate(),
    data: {
      fileId: file.id,
      storeId: file.storeId
    } satisfies SignedDownloadTokenData
  });

  return token + regionSuffix;
};

export let getSignedFileDownloadUrl = async (file: Pick<File, 'id' | 'storeId'>) => {
  if (!env.service.DOWNLOAD_PUBLIC_URL) return undefined;

  let key = await createSignedFileDownloadKey(file);
  return `${env.service.DOWNLOAD_PUBLIC_URL.replace(/\/$/, '')}/files/${file.id}/${encodeURIComponent(key)}`;
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
