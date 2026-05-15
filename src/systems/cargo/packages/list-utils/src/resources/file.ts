import { db } from '@metorial-cargo/db';
import { createResolver } from '../resolver';

export let resolveFiles = createResolver(async ({ scope, ids }) =>
  db.file.findMany({
    where: { ...scope, id: { in: ids } },
    select: { oid: true }
  })
);

export let resolveFileLinks = createResolver(async ({ scope, ids }) =>
  db.fileLink.findMany({
    where: { ...scope, id: { in: ids } },
    select: { oid: true }
  })
);

export let resolveFileReferences = createResolver(async ({ scope, ids }) =>
  db.fileReference.findMany({
    where: { ...scope, id: { in: ids } },
    select: { oid: true }
  })
);

export let resolveFilePurposes = createResolver(async ({ ids }) =>
  db.filePurpose.findMany({
    where: { OR: [{ id: { in: ids } }, { slug: { in: ids } }] },
    select: { oid: true }
  })
);
