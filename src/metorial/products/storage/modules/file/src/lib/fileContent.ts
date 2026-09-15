import { badRequestError, ServiceError } from '@lowerdeck/error';
import { documentService } from '@metorial/module-documents';
import { env } from '../env';
import { fileDownloadService } from '../services/fileDownload';
import { resolveDelegatedFileContent } from './delegation';
import { getStoredFileContent } from './pendingFileContent';
import { downloadDelegatedFileContent } from './ssrfDownload';
import { presignObjectDownload } from '../storage';
import { getStoredFileContentStream, hasPendingFileContent } from './pendingFileContent';

let delegatedContentMaxDownloadBytes = 100 * 1024 * 1024;
let signedDownloadExpirationSecs = 60 * 60;

export let fileRouterSecretHeader = 'metorial-file-router-secret';

export let fileRouterResolutionHeader = 'metorial-file-resolution';
export let fileRouterResolutionValue = 'signed-url';

export type FileRouterResolution = {
  url: string;
  headers: Record<string, string>;
  cacheKey: string | null;
};

let equalsInConstantTime = (a: string, b: string) => {
  let aBytes = new TextEncoder().encode(a);
  let bBytes = new TextEncoder().encode(b);

  if (aBytes.byteLength !== bBytes.byteLength) return false;

  let difference = 0;
  for (let i = 0; i < aBytes.byteLength; i++) difference |= aBytes[i]! ^ bBytes[i]!;

  return difference === 0;
};

export let isFileRouterRequest = (secret: string | null | undefined) => {
  let expected = env.service.FILE_ROUTER_SECRET;
  if (!expected || !secret) return false;

  return equalsInConstantTime(secret, expected);
};

let resolveDownloadTarget = async (d: { fileId: string; key: string }) => {
  let { link, file } = await fileDownloadService.getFileByDownloadKey(d);

  if (link.expiresAt && link.expiresAt < new Date()) {
    throw new ServiceError(
      badRequestError({
        message: 'Link has expired'
      })
    );
  }

  if (file.delegatorOid) {
    let delegated = await resolveDelegatedFileContent(file);
    if (delegated) {
      if (delegated.type === 'redirect') {
        return { file, link, redirectUrl: delegated.url };
      }

      if (delegated.type === 'url') {
        let downloaded = await downloadDelegatedFileContent({
          url: delegated.url,
          maxBytes: delegatedContentMaxDownloadBytes
        });

        return {
          file,
          link,
          content: downloaded.stream,
          metadata: {
            contentType: downloaded.mimeType ?? file.fileType,
            source: 'delegate' as const
          }
        };
      }

      return {
        file,
        link,
        content: delegated.stream,
        metadata: {
          contentType: delegated.mimeType ?? file.fileType,
          source: 'delegate' as const
        }
      };
    }
  }

  let document = await documentService.getDocumentByFileId({
    fileId: file.id
  });

  return { link, file, document };
};

export let getCargoFileContent = async (d: { fileId: string; key: string }) => {
  let resolved = await resolveDownloadTarget(d);
  if (resolved.redirectUrl) {
    return {
      type: 'redirect' as const,
      file: resolved.file,
      link: resolved.link,
      redirectUrl: resolved.redirectUrl
    };
  }

  let { link, file, document } = resolved;

  if (document) {
    return {
      type: 'content' as const,
      file,
      link,
      content: document.resolvedContent ?? document.content.content,
      metadata: {
        contentType: file.fileType,
        size: undefined as number | undefined,
        source: 'document' as const
      }
    };
  }

  let stored = await getStoredFileContentStream({ file });

  return {
    type: 'content' as const,
    file,
    link,
    content: stored.body,
    metadata: {
      contentType: stored.contentType ?? file.fileType,
      size: stored.size,
      source: stored.source
    }
  };
};

export let getCargoFileSignedDownload = async (d: { fileId: string; key: string }) => {
  let resolved = await resolveDownloadTarget(d);
  if (resolved.redirectUrl) {
    return {
      file: resolved.file,
      link: resolved.link,
      url: resolved.redirectUrl,
      isDelegated: true
    };
  }

  let { link, file, document } = resolved;

  if (document) return null;
  if (await hasPendingFileContent(file.oid)) return null;

  let url = await presignObjectDownload({
    key: file.storeId,
    expiresInSecs: signedDownloadExpirationSecs
  });
  if (!url) return null;

  return { file, link, url, isDelegated: false };
};
