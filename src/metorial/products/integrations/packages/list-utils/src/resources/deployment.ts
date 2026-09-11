import { db } from '@metorial-subspace/db';
import { createOptionalResolver, createResolver } from '../resolver';

export let resolveProviderDeployments = createResolver(async ({ ts, ids }) =>
  db.providerDeployment.findMany({
    where: {
      ...ts,
      OR: [{ id: { in: ids } }]
    },
    select: { oid: true }
  })
);

export let resolveProviderConfigs = createResolver(async ({ ts, ids }) =>
  db.providerConfig.findMany({
    where: {
      ...ts,
      OR: [{ id: { in: ids } }]
    },
    select: { oid: true }
  })
);

export let resolveProviderConfigVaults = createResolver(async ({ ts, ids }) =>
  db.providerConfigVault.findMany({
    where: {
      ...ts,
      OR: [{ id: { in: ids } }]
    },
    select: { oid: true }
  })
);

export let resolveProviderAuthConfigs = createResolver(async ({ ts, ids }) =>
  db.providerAuthConfig.findMany({
    where: {
      ...ts,
      OR: [{ id: { in: ids } }]
    },
    select: { oid: true }
  })
);

export let resolveProviderAuthCredentials = createResolver(async ({ ts, ids }) =>
  db.providerAuthCredentials.findMany({
    where: {
      id: { in: ids },
      tenantOid: ts.tenantOid,
      solutionOid: ts.solutionOid,
      OR: [
        {
          origin: 'tenant_created',
          environmentOid: ts.environmentOid
        },
        {
          origin: 'managed_backing'
        }
      ]
    },
    select: { oid: true }
  })
);

export let resolveProviderAuthMethods = createOptionalResolver(async ({ ts, ids }) =>
  db.providerAuthMethod.findMany({
    where: {
      OR: [{ id: { in: ids } }],

      provider: {
        OR: [
          { access: 'public' as const },
          ts.environmentOid && ts.tenantOid
            ? {
                access: 'tenant' as const,
                ownerTenantOid: ts.tenantOid,
                ownerSolutionOid: ts.solutionOid
              }
            : undefined!
        ].filter(Boolean)
      }
    },
    select: { oid: true }
  })
);

export let resolveScmRepos = createResolver(async ({ ts, ids }) =>
  db.scmRepo.findMany({
    where: {
      tenantOid: ts.tenantOid,
      solutionOid: ts.solutionOid,
      id: { in: ids }
    },
    select: { oid: true }
  })
);
