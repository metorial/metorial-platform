import { db } from '@metorial-subspace/db';
import { createResolver } from '../resolver';

export let resolveAgents = createResolver(async ({ ts, ids }) =>
  db.agent.findMany({
    where: {
      ...ts,
      OR: [{ id: { in: ids } }, { slug: { in: ids } }]
    },
    select: { oid: true }
  })
);
