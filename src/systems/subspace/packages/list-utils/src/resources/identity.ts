import { db } from '@metorial-subspace/db';
import { createResolver } from '../resolver';

export let resolveIdentities = createResolver(async ({ ts, ids }) =>
  db.identity.findMany({
    where: {
      ...ts,
      OR: [{ id: { in: ids } }]
    },
    select: { oid: true }
  })
);

export let resolveIdentityActors = createResolver(async ({ ts, ids }) =>
  db.identityActor.findMany({
    where: {
      ...ts,
      OR: [{ id: { in: ids } }]
    },
    select: { oid: true }
  })
);
