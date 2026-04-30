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

export let resolveIntegrationInstances = createResolver(async ({ ts, ids }) =>
  db.integrationInstance.findMany({
    where: {
      id: { in: ids },
      tenantOid: ts.tenantOid,
      solutionOid: ts.solutionOid,
      environmentOid: ts.environmentOid
    },
    select: { oid: true }
  })
);

export let resolveIntegrationInstanceProviders = createResolver(async ({ ts, ids }) =>
  db.integrationInstanceProvider.findMany({
    where: {
      id: { in: ids },
      tenantOid: ts.tenantOid,
      solutionOid: ts.solutionOid,
      environmentOid: ts.environmentOid
    },
    select: { oid: true }
  })
);

export let resolveDelegatedIntegrationInstances = createResolver(async ({ ts, ids }) =>
  db.delegatedIntegrationInstance.findMany({
    where: {
      id: { in: ids },
      tenantOid: ts.tenantOid,
      solutionOid: ts.solutionOid,
      environmentOid: ts.environmentOid
    },
    select: { oid: true }
  })
);

export let resolveDelegatedIntegrationInstanceProviders = createResolver(async ({ ts, ids }) =>
  db.delegatedIntegrationInstanceProvider.findMany({
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
