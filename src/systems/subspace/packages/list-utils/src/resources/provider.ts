import { db } from '@metorial-subspace/db';
import { createOptionalResolver, createPublicResolver, createResolver } from '../resolver';

export let resolveProviders = createOptionalResolver(async ({ ts, ids }) =>
  db.provider.findMany({
    where: {
      AND: [
        {
          OR: [
            { id: { in: ids } },
            { slug: { in: ids } },
            {
              listing: { id: { in: ids } }
            }
          ]
        },

        {
          OR: [
            { access: 'public' as const },
            ts.tenantOid && ts.solutionOid
              ? {
                  access: 'tenant' as const,
                  ownerTenantOid: ts.tenantOid,
                  ownerSolutionOid: ts.solutionOid
                }
              : undefined!
          ].filter(Boolean)
        }
      ]
    },
    select: { oid: true }
  })
);

export let resolveProviderVersions = createOptionalResolver(async ({ ts, ids }) =>
  db.providerVersion.findMany({
    where: {
      id: { in: ids },

      provider: {
        OR: [
          { access: 'public' as const },
          ts.tenantOid && ts.solutionOid
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

export let resolveProviderListings = createOptionalResolver(async ({ ts, ids }) =>
  db.providerListing.findMany({
    where: {
      OR: [
        { id: { in: ids } },
        { slug: { in: ids } },
        { provider: { id: { in: ids } } },
        { provider: { slug: { in: ids } } }
      ],

      provider: {
        OR: [
          { access: 'public' as const },
          ts.tenantOid && ts.solutionOid
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

export let resolveProviderTools = createPublicResolver(async ({ ids }) =>
  db.providerTool.findMany({
    where: {
      OR: [{ id: { in: ids } }]
    },
    select: { oid: true }
  })
);

export let resolveProviderCollections = createPublicResolver(async ({ ids }) =>
  db.providerListingCollection.findMany({
    where: {
      OR: [{ id: { in: ids } }, { slug: { in: ids } }]
    },
    select: { oid: true }
  })
);

export let resolveProviderCategories = createPublicResolver(async ({ ids }) =>
  db.providerListingCategory.findMany({
    where: {
      OR: [{ id: { in: ids } }, { slug: { in: ids } }]
    },
    select: { oid: true }
  })
);

export let resolvePublishers = createPublicResolver(async ({ ids }) =>
  db.provider.findMany({
    where: {
      OR: [{ id: { in: ids } }, { slug: { in: ids } }]
    },
    select: { oid: true }
  })
);

export let resolveProviderGroups = createResolver(async ({ ts, ids }) =>
  db.providerListingGroup.findMany({
    where: {
      tenantOid: ts.tenantOid,
      OR: [{ id: { in: ids } }, { slug: { in: ids } }]
    },
    select: { oid: true }
  })
);

export let resolveProviderSpecifications = createResolver(async ({ ts, ids }) =>
  db.providerSpecification.findMany({
    where: {
      provider: {
        OR: [
          { access: 'public' as const },
          {
            access: 'tenant' as const,
            ownerTenantOid: ts.tenantOid,
            ownerSolutionOid: ts.solutionOid
          }
        ]
      },

      id: { in: ids }
    },
    select: { oid: true }
  })
);

export let resolveCustomProviders = createResolver(async ({ ts, ids }) =>
  db.customProvider.findMany({
    where: {
      id: { in: ids },
      solutionOid: ts.solutionOid,
      tenantOid: ts.tenantOid
    },
    select: { oid: true }
  })
);

export let resolveCustomProviderDeployments = createResolver(async ({ ts, ids }) =>
  db.customProviderDeployment.findMany({
    where: {
      id: { in: ids },
      solutionOid: ts.solutionOid,
      tenantOid: ts.tenantOid
    },
    select: { oid: true }
  })
);

export let resolveCustomProviderVersions = createResolver(async ({ ts, ids }) =>
  db.customProviderVersion.findMany({
    where: {
      id: { in: ids },
      solutionOid: ts.solutionOid,
      tenantOid: ts.tenantOid
    },
    select: { oid: true }
  })
);

export let resolveCustomProviderEnvironments = createResolver(async ({ ts, ids }) =>
  db.customProviderEnvironment.findMany({
    where: {
      id: { in: ids },
      tenantOid: ts.tenantOid
    },
    select: { oid: true }
  })
);
