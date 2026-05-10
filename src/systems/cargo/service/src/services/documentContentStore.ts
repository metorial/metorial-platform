import type { Prisma, PrismaClient } from '../../prisma/generated/client';
import { db } from '../db';

type DbClient = PrismaClient | Prisma.TransactionClient;

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

let getClient = (client?: DbClient) => client ?? db;

let getEffectiveDocumentStoreSource = async (
  document: DocumentStoreSource,
  client?: DbClient
): Promise<DocumentStoreSource> => {
  let resolved = document;
  let dbClient = getClient(client);

  while (!resolved.isContentOwner && resolved.parentDocumentOid) {
    let parent = await dbClient.document.findFirst({
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
};

let getEffectiveDocumentStoreSourceByDocumentId = async (
  documentId: string,
  client?: DbClient
): Promise<DocumentStoreSource | null> => {
  let document = await getClient(client).document.findFirst({
    where: {
      id: documentId,
      file: {
        status: 'active'
      }
    },
    select: effectiveDocumentStoreSelect
  });

  if (!document) return null;

  return await getEffectiveDocumentStoreSource(document, client);
};

export {
  effectiveDocumentStoreSelect,
  getEffectiveDocumentStoreSource,
  getEffectiveDocumentStoreSourceByDocumentId
};
