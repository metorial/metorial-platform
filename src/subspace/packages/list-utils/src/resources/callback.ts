import { db } from '@metorial-subspace/db';
import { createResolver } from '../resolver';

export let resolveCallbacks = createResolver(async ({ ts, ids }) =>
  db.callback.findMany({
    where: {
      tenantOid: ts.tenantOid,
      solutionOid: ts.solutionOid,
      environmentOid: ts.environmentOid,
      id: { in: ids }
    },
    select: { oid: true }
  })
);
