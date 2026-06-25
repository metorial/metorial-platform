import { Service } from '@lowerdeck/service';
import type { Prisma } from '@metorial-cargo/db';
import { withTransaction } from '@metorial-cargo/db';

type DocumentStoreSource = {
  id: string;
  oid: bigint;
  isContentOwner: boolean;
  parentDocumentOid: bigint | null;
  file: {
    id: string;
    storeId: string;
  };
};

let effectiveDocumentStoreSelect = {
  id: true,
  oid: true,
  isContentOwner: true,
  parentDocumentOid: true,
  file: {
    select: {
      id: true,
      storeId: true
    }
  }
} satisfies Prisma.DocumentSelect;

class InternalDocumentContentStoreServiceImpl {
  async getEffectiveDocumentStoreSource(
    document: DocumentStoreSource
  ): Promise<DocumentStoreSource> {
    return await withTransaction(
      async db => {
        let resolved = document;

        while (!resolved.isContentOwner && resolved.parentDocumentOid) {
          let parent = await db.document.findFirst({
            where: {
              oid: resolved.parentDocumentOid,
              file: {
                status: 'active'
              }
            },
            select: effectiveDocumentStoreSelect
          });

          if (!parent) {
            return resolved;
          }

          resolved = parent;
        }

        return resolved;
      },
      { ifExists: true }
    );
  }

  async getEffectiveDocumentStoreSourceByDocumentId(
    documentId: string
  ): Promise<DocumentStoreSource | null> {
    return await withTransaction(
      async db => {
        let document = await db.document.findFirst({
          where: {
            id: documentId,
            file: {
              status: 'active'
            }
          },
          select: effectiveDocumentStoreSelect
        });

        if (!document) return null;

        return await this.getEffectiveDocumentStoreSource(document);
      },
      { ifExists: true }
    );
  }
}

export let internalDocumentContentStoreService = Service.create(
  'cargoInternalDocumentContentStoreService',
  () => new InternalDocumentContentStoreServiceImpl()
).build();
