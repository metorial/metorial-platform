import { db } from '@metorial-cargo/db';
import { createResolver } from '../resolver';

export let resolveTenantActors = createResolver(async ({ selector, ids }) =>
  db.tenantActor.findMany({
    where: {
      tenantOid: selector.tenant.oid,
      id: { in: ids }
    },
    select: { oid: true }
  })
);
