import type { File, FileLink } from '../../prisma/generated/client';
import { env } from '../env';

let getDownloadUrl = (file: File, fileLink: FileLink) => {
  if (!env.service.DOWNLOAD_PUBLIC_URL) return undefined!;

  return `${env.service.DOWNLOAD_PUBLIC_URL}/files/${file.id}/${fileLink.key}`;
};

export let fileLinkPresenter = (fileLink: FileLink & { file: File }) => ({
  object: 'cargo#fileLink',
  id: fileLink.id,
  key: fileLink.key,
  fileId: fileLink.file.id,
  expiresAt: fileLink.expiresAt,
  downloadUrl: getDownloadUrl(fileLink.file, fileLink),
  createdAt: fileLink.createdAt
});
