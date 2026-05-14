import { Service } from '@lowerdeck/service';
import { db, withTransaction } from '../db';

let documentVersionRetentionMs = 30 * 24 * 60 * 60 * 1000;

class DocumentCleanupServiceImpl {
  private getVersionCutoff(now = new Date()) {
    return new Date(now.getTime() - documentVersionRetentionMs);
  }

  private async deleteContentIfOrphaned(contentOid: bigint) {
    let [documentCount, versionCount] = await Promise.all([
      db.document.count({
        where: {
          contentOid
        }
      }),
      db.documentVersion.count({
        where: {
          contentOid
        }
      })
    ]);

    if (documentCount === 0 && versionCount === 0) {
      await db.documentContent.delete({
        where: {
          oid: contentOid
        }
      });
    }
  }

  async listStaleDocumentVersions(d?: { cursor?: string; limit?: number }) {
    return await db.documentVersion.findMany({
      where: {
        id: d?.cursor ? { gt: d.cursor } : undefined,
        createdAt: {
          lt: this.getVersionCutoff()
        },
        currentVersionOfDocuments: {
          none: {}
        }
      },
      orderBy: {
        id: 'asc'
      },
      select: {
        id: true
      },
      take: d?.limit ?? 100
    });
  }

  async cleanupDocumentVersion(d: { documentVersionId: string }) {
    let version = await db.documentVersion.findUnique({
      where: {
        id: d.documentVersionId
      },
      include: {
        currentVersionOfDocuments: {
          select: {
            id: true
          }
        }
      }
    });
    if (!version || version.currentVersionOfDocuments.length > 0) return false;

    let contentOid = version.contentOid;

    await withTransaction(async db => {
      await db.documentVersion.updateMany({
        where: {
          previousVersionOid: version.oid
        },
        data: {
          previousVersionOid: version.previousVersionOid
        }
      });

      await db.documentVersion.delete({
        where: {
          id: version.id
        }
      });
    });

    await this.deleteContentIfOrphaned(contentOid);

    return true;
  }
}

export let documentCleanupService = Service.create(
  'cargoDocumentCleanupService',
  () => new DocumentCleanupServiceImpl()
).build();
