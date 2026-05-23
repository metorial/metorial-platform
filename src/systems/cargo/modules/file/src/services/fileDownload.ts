import { notFoundError, ServiceError } from '@mtsrc/error';
import { Service } from '@mtsrc/service';
import { db } from '@metorial-cargo/db';
import { verifySignedFileDownloadKey } from '../lib/signedDownloadUrl';

class FileDownloadServiceImpl {
  async getFileByDownloadKey(d: { fileId: string; key: string }) {
    let fileLink = await db.fileLink.findFirst({
      where: {
        key: d.key,
        file: {
          id: d.fileId,
          status: 'active'
        }
      },
      include: {
        file: true
      }
    });

    if (fileLink) {
      return {
        link: {
          expiresAt: fileLink.expiresAt
        },
        file: fileLink.file
      };
    }

    let signed = await verifySignedFileDownloadKey(d);
    if (!signed) throw new ServiceError(notFoundError('fileDownload', d.key));

    let file = await db.file.findFirst({
      where: {
        id: signed.fileId,
        storeId: signed.storeId,
        status: 'active'
      }
    });

    if (!file) throw new ServiceError(notFoundError('fileDownload', d.key));

    return {
      link: {
        expiresAt: null
      },
      file
    };
  }
}

export let fileDownloadService = Service.create(
  'cargoFileDownloadService',
  () => new FileDownloadServiceImpl()
).build();
