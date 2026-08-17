import { badRequestError, ServiceError } from '@lowerdeck/error';
import { documentService } from '@metorial/module-documents';
import { fileDownloadService } from '../services/fileDownload';
import { getCargoFilesBucketName, getStorage } from '../storage';

export let getCargoFileContent = async (d: { fileId: string; key: string }) => {
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

  let object = await getStorage().getObject(getCargoFilesBucketName(), file.storeId);

  return {
    file,
    link,
    content: object.data,
    metadata: {
      contentType: object.metadata.content_type ?? file.fileType,
      source: 'object' as const
    }
  };
};
