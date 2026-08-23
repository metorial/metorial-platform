import { badRequestError, ServiceError } from '@lowerdeck/error';
import { documentService } from '@metorial/module-documents';
import { fileDownloadService } from '../services/fileDownload';
import { resolveDelegatedFileContent } from './delegation';
import { getStoredFileContent } from './pendingFileContent';
import { downloadDelegatedFileContent } from './ssrfDownload';

let delegatedContentMaxDownloadBytes = 100 * 1024 * 1024;

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
  if (document) {
    return {
      file,
      link,
      content: document.resolvedContent ?? document.content.content,
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
    metadata: {
      contentType: stored.contentType ?? file.fileType,
      source: stored.source
    }
  };
};
