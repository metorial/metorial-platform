import type { Prisma } from '../../prisma/generated/client';
import { withTransaction } from '../db';

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

let getEffectiveDocumentStoreSource = async (
  document: DocumentStoreSource
): Promise<DocumentStoreSource> =>
  await withTransaction(
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

let getEffectiveDocumentStoreSourceByDocumentId = async (
  documentId: string
): Promise<DocumentStoreSource | null> =>
  await withTransaction(
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

      return await getEffectiveDocumentStoreSource(document);
    },
    { ifExists: true }
  );

export {
  effectiveDocumentStoreSelect,
  getEffectiveDocumentStoreSource,
  getEffectiveDocumentStoreSourceByDocumentId
};
