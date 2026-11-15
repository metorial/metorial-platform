import { db } from '@metorial/db';
import { createResolver } from '../resolver';

export let resolveResourceActors = createResolver(async ({ selector, ids }) =>
  db.resourceActor.findMany({
    where: {
      projectOid: selector.project.oid,
      id: { in: ids }
    },
    select: { oid: true }
  })
);
