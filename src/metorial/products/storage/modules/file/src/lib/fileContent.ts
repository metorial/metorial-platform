import { badRequestError, ServiceError } from '@lowerdeck/error';
import { documentService } from '@metorial/module-documents';
import { env } from '../env';
import { fileDownloadService } from '../services/fileDownload';
import { presignObjectDownload } from '../storage';
import { getStoredFileContentStream, hasPendingFileContent } from './pendingFileContent';

let signedDownloadExpirationSecs = 60 * 60;

/// Sent by the file router worker to prove it is the caller. Anyone able to set
/// it can trade a valid download key for a signed object storage URL, so it must
/// never be forwarded from client input.
export let fileRouterSecretHeader = 'metorial-file-router-secret';

/// Marks a response as a router resolution rather than file content.
export let fileRouterResolutionHeader = 'metorial-file-resolution';
export let fileRouterResolutionValue = 'signed-url';

export type FileRouterResolution = {
  url: string;
  headers: Record<string, string>;
  /// Stable identity of the bytes behind this URL, or null when the response
  /// must not be cached (expiring links).
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

/// Resolves and authorizes a download key. Every way of serving a file goes
/// through here, so access control cannot be skipped by picking another path.
let resolveDownloadTarget = async (d: { fileId: string; key: string }) => {
  let { link, file } = await fileDownloadService.getFileByDownloadKey(d);

  if (link.expiresAt && link.expiresAt < new Date()) {
    throw new ServiceError(
      badRequestError({
        message: 'Link has expired'
      })
    );
  }

  let document = await documentService.getDocumentByFileId({
    fileId: file.id
  });

  return { link, file, document };
};

export let getCargoFileContent = async (d: { fileId: string; key: string }) => {
  let { link, file, document } = await resolveDownloadTarget(d);

  if (document) {
    return {
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

/**
 * Authorizes a download and hands back a signed object storage URL so that the
 * file router can serve the bytes itself.
 *
 * Returns null whenever the content cannot be reached that way — documents are
 * rendered from the database, freshly uploaded content may not have been
 * flushed yet, and non-S3 backends cannot presign. Callers fall back to serving
 * the file directly.
 */
export let getCargoFileSignedDownload = async (d: { fileId: string; key: string }) => {
  let { link, file, document } = await resolveDownloadTarget(d);

  if (document) return null;
  if (await hasPendingFileContent(file.oid)) return null;

  let url = await presignObjectDownload({
    key: file.storeId,
    expiresInSecs: signedDownloadExpirationSecs
  });
  if (!url) return null;

  return { file, link, url };
};
