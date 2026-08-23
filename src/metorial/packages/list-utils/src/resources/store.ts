import { db } from '@metorial/db';
import { createResolver } from '../resolver';

export let resolveStores = createResolver(async ({ scope, ids }) =>
  db.store.findMany({
    where: { ...scope, id: { in: ids } },
    select: { oid: true }
  })
);

export let resolveStoreItems = createResolver(async ({ scope, ids }) =>
  db.storeItem.findMany({
    where: {
      id: { in: ids },
      store: scope
    },
    select: { oid: true }
  })
);

export let resolveStoreDirectories = createResolver(async ({ scope, ids }) =>
  db.storeDirectory.findMany({
    where: {
      id: { in: ids },
      store: scope
    },
    select: { oid: true }
  })
);

export let resolveStoreTemplates = createResolver(async ({ scope, ids }) =>
  db.storeTemplate.findMany({
    where: {
      id: { in: ids },
      OR: [
        {
          projectOid: scope.projectOid,
          instanceOid: scope.instanceOid
        },
        {
          projectOid: null,
          instanceOid: null
        }
      ]
    },
    select: { oid: true }
  })
);

export let resolveStoreVersions = createResolver(async ({ scope, ids }) =>
  db.storeVersion.findMany({
    where: {
      id: { in: ids },
      store: scope
    },
    select: { oid: true }
  })
);

export let resolveStoreParticipants = createResolver(async ({ scope, ids }) =>
  db.storeParticipant.findMany({
    where: {
      id: { in: ids },
      store: scope
    },
    select: { oid: true }
  })
);
