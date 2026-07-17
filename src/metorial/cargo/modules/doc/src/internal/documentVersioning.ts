import { Service } from '@lowerdeck/service';
import { getId } from '@metorial/cargo-config/id';
import type { Prisma } from '@metorial/db';
import { withTransaction } from '@metorial/db';
import type { documentInclude } from '../services/document';

type DocumentRecord = Prisma.DocumentGetPayload<{
  include: typeof documentInclude;
}>;

type VersionContext = {
  resourceTenant: { oid: bigint };
  resourceGroup: { oid: bigint };
};

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

  async createVersion(
    d: VersionContext & {
      document: { oid: bigint };
      versionNumber: number;
      contentOid: bigint;
      previousVersionOid?: bigint | null;
      listEditedAt?: Date;
    }
  ) {
    return await withTransaction(async db => {
      let generated = getId('documentVersion');

      return await db.documentVersion.create({
        data: {
          ...generated,
          resourceTenantOid: d.resourceTenant.oid,
          resourceGroupOid: d.resourceGroup.oid,
          documentOid: d.document.oid,
          versionNumber: d.versionNumber,
          contentOid: d.contentOid,
          previousVersionOid: d.previousVersionOid ?? null,
          listEditedAt: d.listEditedAt
        },
        include: {
          content: true
        }
      });
    });
  }
}

export let internalDocumentVersioningService = Service.create(
  'cargoInternalDocumentVersioningService',
  () => new InternalDocumentVersioningServiceImpl()
).build();
