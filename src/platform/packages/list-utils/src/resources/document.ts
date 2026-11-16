import { db } from '@metorial/db';
import { createResolver } from '../resolver';

export let resolveDocuments = createResolver(async ({ scope, ids }) =>
  db.document.findMany({
    where: { ...scope, id: { in: ids } },
    select: { oid: true }
  })
);

export let resolveDocumentVersions = createResolver(async ({ scope, ids }) =>
  db.documentVersion.findMany({
    where: { ...scope, id: { in: ids } },
    select: { oid: true }
  })
);

export let resolveDocumentParticipants = createResolver(async ({ scope, ids }) =>
  db.documentParticipant.findMany({
    where: {
      id: { in: ids },
      document: scope
    },
    select: { oid: true }
  })
);
