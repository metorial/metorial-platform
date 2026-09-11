import { db } from '@metorial-subspace/db';
import { createResolver } from '../resolver';

export let resolveCallbacks = createResolver(async ({ ts, ids }) =>
  db.callback.findMany({
    where: {
      id: { in: ids },
      tenantOid: ts.tenantOid,
      solutionOid: ts.solutionOid,
      environmentOid: ts.environmentOid
    },
    select: { oid: true }
  })
);

export let resolveCallbackInstances = createResolver(async ({ ts, ids }) =>
  db.callbackInstance.findMany({
    where: {
      id: { in: ids },
      tenantOid: ts.tenantOid,
      solutionOid: ts.solutionOid,
      environmentOid: ts.environmentOid
    },
    select: { oid: true }
  })
);
