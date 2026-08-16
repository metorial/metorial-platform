import { Service } from '@lowerdeck/service';
import type { Prisma } from '@metorial/db';
import { ID, withTransaction } from '@metorial/db';
import type { documentInclude } from '../services/document';

type DocumentRecord = Prisma.DocumentGetPayload<{
  include: typeof documentInclude;
}>;

let activeVersionWindowMs = 3 * 60 * 60 * 1000;

class InternalDocumentVersioningServiceImpl {
  getNextDraftVersionExpiresAt(now = new Date()) {
    return new Date(now.getTime() + activeVersionWindowMs);
  }

  shouldCreateNewVersionForWrite(document: DocumentRecord, now = new Date()) {
    if (!document.currentVersion) return true;

    if (document.draftVersionExpiresAt) {
      return document.draftVersionExpiresAt.getTime() <= now.getTime();
    }

    return (
      now.getTime() - document.currentVersion.createdAt.getTime() >= activeVersionWindowMs
    );
  }

  async createVersion(d: {
    project: { oid: bigint };
    instance: { oid: bigint };
    document: { oid: bigint; maxVersionNumber: number };
    contentOid: bigint;
    previousVersionOid?: bigint | null;
    listEditedAt?: Date;
  }) {
    return await withTransaction(async db => {
      let aggregate = await db.documentVersion.aggregate({
        where: {
          documentOid: d.document.oid
        },
        _max: {
          versionNumber: true
        }
      });
      let actualMaxVersionNumber = aggregate._max.versionNumber ?? 0;

      if (d.document.maxVersionNumber !== actualMaxVersionNumber) {
        await db.document.update({
          where: {
            oid: d.document.oid
          },
          data: {
            maxVersionNumber: actualMaxVersionNumber
          }
        });
      }

      let nextVersionNumber = actualMaxVersionNumber + 1;

      let version = await db.documentVersion.create({
        data: {
          id: await ID.generateId('documentVersion'),
          projectOid: d.project.oid,
          instanceOid: d.instance.oid,
          documentOid: d.document.oid,
          versionNumber: nextVersionNumber,
          contentOid: d.contentOid,
          previousVersionOid: d.previousVersionOid ?? null,
          listEditedAt: d.listEditedAt
        },
        include: {
          content: true
        }
      });

      await db.document.update({
        where: {
          oid: d.document.oid
        },
        data: {
          maxVersionNumber: nextVersionNumber
        }
      });

      return version;
    });
  }
}

export let internalDocumentVersioningService = Service.create(
  'cargoInternalDocumentVersioningService',
  () => new InternalDocumentVersioningServiceImpl()
).build();
