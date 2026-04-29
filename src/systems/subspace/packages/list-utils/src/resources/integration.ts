import { db } from '@metorial-subspace/db';
import { createResolver } from '../resolver';

export let resolveIntegrations = createResolver(async ({ ts, ids }) =>
  db.integration.findMany({
    where: {
      id: { in: ids },
      tenantOid: ts.tenantOid,
      solutionOid: ts.solutionOid,
      environmentOid: ts.environmentOid
    },
    select: { oid: true }
  })
);

export let resolveIntegrationProviders = createResolver(async ({ ts, ids }) =>
  db.integrationProvider.findMany({
    where: {
      id: { in: ids },
      tenantOid: ts.tenantOid,
      solutionOid: ts.solutionOid,
      environmentOid: ts.environmentOid
    },
    select: { oid: true }
  })
);

export let resolveIntegrationProviderVersions = createResolver(async ({ ts, ids }) =>
  db.integrationProviderVersion.findMany({
    where: {
      id: { in: ids },
      integrationProvider: {
        tenantOid: ts.tenantOid,
        solutionOid: ts.solutionOid,
        environmentOid: ts.environmentOid
      }
    },
    select: { oid: true }
  })
);
