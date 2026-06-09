import { db } from '@metorial-subspace/db';
import { createOptionalResolver, createPublicResolver, createResolver } from '../resolver';

let providerEnvironmentVisibilityFilter = (environmentOid?: bigint) =>
  environmentOid
    ? {
        OR: [
          { hasEnvironments: false },
          {
            providerEnvironments: {
              some: {
                environmentOid,
                currentVersionOid: { not: null }
              }
            }
          }
        ]
      }
    : undefined!;

let providerVersionEnvironmentVisibilityFilter = (environmentOid?: bigint) =>
  environmentOid
    ? {
        OR: [
          { isEnvironmentLocked: false },
          {
            providerEnvironmentVersions: {
              some: { environmentOid }
            }
          }
        ]
      }
    : undefined!;

let customProviderEnvironmentVisibilityFilter = (environmentOid: bigint) => ({
  customProviderEnvironments: {
    some: {
      environmentOid,
      providerEnvironment: {
        is: {
          currentVersionOid: { not: null }
        }
      }
    }
  }
});

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
        },
        providerEnvironmentVisibilityFilter(ts.environmentOid)
      ].filter(Boolean)
    },
    select: { oid: true }
  })
);

export let resolveProviderVersions = createOptionalResolver(async ({ ts, ids }) =>
  db.providerVersion.findMany({
    where: {
      id: { in: ids },
      AND: [providerVersionEnvironmentVisibilityFilter(ts.environmentOid)].filter(Boolean),

      provider: {
        AND: [
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
          },
          providerEnvironmentVisibilityFilter(ts.environmentOid)
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
        AND: [
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
          },
          providerEnvironmentVisibilityFilter(ts.environmentOid)
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
        AND: [
          {
            OR: [
              { access: 'public' as const },
              {
                access: 'tenant' as const,
                ownerTenantOid: ts.tenantOid,
                ownerSolutionOid: ts.solutionOid
              }
            ]
          },
          providerEnvironmentVisibilityFilter(ts.environmentOid)
        ].filter(Boolean)
      },

      id: { in: ids }
    },
    select: { oid: true }
  })
);

export let resolveAuthMethods = createResolver(async ({ ts, ids }) =>
  db.providerAuthMethod.findMany({
    where: {
      provider: {
        AND: [
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
          },
          providerEnvironmentVisibilityFilter(ts.environmentOid)
        ].filter(Boolean)
      },

      id: { in: ids }
    },
    select: { oid: true }
  })
);

export let resolveAuthMethodsGlobal = createResolver(async ({ ts, ids }) =>
  db.providerAuthMethodGlobal.findMany({
    where: {
      provider: {
        AND: [
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
          },
          providerEnvironmentVisibilityFilter(ts.environmentOid)
        ].filter(Boolean)
      },

      OR: [{ id: { in: ids } }, { providerAuthMethods: { some: { id: { in: ids } } } }]
    },
    select: { oid: true }
  })
);

export let resolveCustomProviders = createResolver(async ({ ts, ids }) =>
  db.customProvider.findMany({
    where: {
      id: { in: ids },
      solutionOid: ts.solutionOid,
      tenantOid: ts.tenantOid,
      AND: [customProviderEnvironmentVisibilityFilter(ts.environmentOid)]
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
      tenantOid: ts.tenantOid,
      customProvider: customProviderEnvironmentVisibilityFilter(ts.environmentOid)
    },
    select: { oid: true }
  })
);

export let resolveCustomProviderEnvironments = createResolver(async ({ ts, ids }) =>
  db.customProviderEnvironment.findMany({
    where: {
      id: { in: ids },
      tenantOid: ts.tenantOid,
      solutionOid: ts.solutionOid,
      environmentOid: ts.environmentOid,
      providerEnvironment: {
        is: {
          currentVersionOid: { not: null }
        }
      }
    },
    select: { oid: true }
  })
);
