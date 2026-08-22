import { badRequestError, ServiceError } from '@lowerdeck/error';
import { documentService } from '@metorial/module-documents';
import { fileDownloadService } from '../services/fileDownload';
import { resolveDelegatedFileContent } from './delegation';
import { getStoredFileContent } from './pendingFileContent';

export let getCargoFileContent = async (d: { fileId: string; key: string }) => {
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
      return delegated.type === 'url'
        ? {
            file,
            link,
            content: null,
            redirectUrl: delegated.url,
            metadata: {
              contentType: file.fileType,
              source: 'delegate' as const
            }
          }
        : {
            file,
            link,
            content: delegated.stream,
            redirectUrl: null,
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
  if (document) {
    return {
      file,
      link,
      content: document.resolvedContent ?? document.content.content,
      redirectUrl: null,
      metadata: {
        contentType: file.fileType,
        source: 'document' as const
      }
    };
  }

  let stored = await getStoredFileContent({ file });

  return {
    file,
    link,
    content: stored.data,
    redirectUrl: null,
    metadata: {
      contentType: stored.contentType ?? file.fileType,
      source: stored.source
    }
  };
};
