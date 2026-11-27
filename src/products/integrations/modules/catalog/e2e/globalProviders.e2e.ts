import {
  expectServiceError,
  firstPage,
  useMcpTestServer,
  useOrganization
} from '@metorial/e2e';
import { loadOrganizationFixture, subspaceDb } from '@metorial/e2e/db';
import { subspaceScopeService, tenantService } from '@metorial-subspace/module-tenant';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  providerListingService,
  providerService,
  providerSpecificationService,
  providerToolService,
  providerVersionService
} from '../src';
import {
  type CatalogProvider,
  catalogTools,
  deployCatalogProvider,
  listAllPages,
  makeProviderGlobal,
  makeProviderTenantOwned
} from './_fixtures';

let ids = (items: { id: string }[]) => items.map(item => item.id);

describe('module-catalog public and global providers', () => {
  let owner = useOrganization();
  let viewer = useOrganization();
  let trusted = useOrganization();
  let server = useMcpTestServer({ tools: catalogTools });

  let loadProvider = (deployed: CatalogProvider) =>
    subspaceDb.provider.findUniqueOrThrow({ where: { oid: deployed.provider.oid } });

  describe('a public provider that is still bound to its environments', () => {
    let deployed: CatalogProvider;

    beforeAll(async () => {
      deployed = await deployCatalogProvider(owner, server.url);
      await providerService.updateProvider({
        provider: deployed.provider,
        input: { access: 'public' }
      });
    }, 180_000);

    afterAll(async () => {
      if (deployed) await makeProviderTenantOwned(await loadProvider(deployed));
    });

    it('stays hidden from tenants without an environment of it', async () => {
      let { instance: ownerInstance } = await loadOrganizationFixture(owner.ids);
      let { instance } = await loadOrganizationFixture(viewer.ids);

      let listing = await providerListingService.getProviderListingById({
        instance: ownerInstance,
        providerListingId: deployed.listing.id
      });
      expect(listing.isPublic).toBe(true);

      await expectServiceError(
        providerService.getProviderById({ instance, providerId: deployed.provider.id }),
        'not_found'
      );
      await expectServiceError(
        providerListingService.getProviderListingById({
          instance,
          providerListingId: deployed.listing.id
        }),
        'not_found'
      );
      expect(
        await firstPage(
          await providerService.listProviders({ instance, ids: [deployed.provider.id] })
        )
      ).toEqual([]);
      expect(
        await firstPage(
          await providerVersionService.listProviderVersions({
            instance,
            providerIds: [deployed.provider.id]
          })
        )
      ).toEqual([]);
    });
  });

  describe('a global provider', () => {
    let deployed: CatalogProvider;

    beforeAll(async () => {
      deployed = await deployCatalogProvider(owner, server.url);
      await makeProviderGlobal(deployed.provider);
    }, 180_000);

    afterAll(async () => {
      if (deployed) await makeProviderTenantOwned(await loadProvider(deployed));
    });

    it('is visible to every tenant with its listing, versions and tools', async () => {
      let { instance } = await loadOrganizationFixture(viewer.ids);

      let provider = await providerService.getProviderById({
        instance,
        providerId: deployed.provider.id
      });
      expect(provider.access).toBe('public');
      expect(
        ids(
          await firstPage(
            await providerService.listProviders({ instance, ids: [provider.id] })
          )
        )
      ).toEqual([provider.id]);

      let listing = await providerListingService.getProviderListingById({
        instance,
        providerListingId: deployed.listing.id
      });
      expect(listing.isPublic).toBe(true);
      expect(
        ids(
          await listAllPages(
            await providerListingService.listProviderListings({ instance, isPublic: true })
          )
        )
      ).toContain(listing.id);
      expect(
        ids(
          await firstPage(
            await providerListingService.listProviderListings({
              instance,
              onlyFromTenant: true
            })
          )
        )
      ).not.toContain(listing.id);

      let versions = await firstPage(
        await providerVersionService.listProviderVersions({
          instance,
          providerIds: [provider.id]
        })
      );
      expect(ids(versions)).toEqual([deployed.version.id]);

      let version = await providerVersionService.getProviderVersionById({
        instance,
        providerVersionId: deployed.version.id
      });
      let specification = await providerSpecificationService.getProviderSpecificationById({
        instance,
        providerSpecificationId: version.specification!.id
      });
      expect(specification.oid).toBe(deployed.version.specificationOid);

      let tools = await firstPage(
        await providerToolService.listProviderTools({ instance, providerVersion: version })
      );
      expect(tools.map(tool => tool.name).sort()).toEqual(
        deployed.tools.map(tool => tool.name).sort()
      );
    });

    it('hides a deprecated provider from lists but still resolves it by id', async () => {
      let { instance } = await loadOrganizationFixture(viewer.ids);

      await providerService.updateProvider({
        provider: await loadProvider(deployed),
        input: { isDeprecated: true }
      });

      try {
        expect(
          ids(await listAllPages(await providerService.listProviders({ instance })))
        ).not.toContain(deployed.provider.id);
        expect(
          ids(
            await listAllPages(
              await providerService.listProviders({ instance, includeDeprecated: true })
            )
          )
        ).toContain(deployed.provider.id);
        expect(
          ids(
            await firstPage(
              await providerService.listProviders({ instance, ids: [deployed.provider.id] })
            )
          )
        ).toEqual([deployed.provider.id]);
        expect(
          (
            await providerService.getProviderById({
              instance,
              providerId: deployed.provider.id
            })
          ).isDeprecated
        ).toBe(true);

        expect(
          ids(
            await listAllPages(await providerListingService.listProviderListings({ instance }))
          )
        ).not.toContain(deployed.listing.id);
        expect(
          ids(
            await firstPage(
              await providerListingService.listProviderListings({
                instance,
                ids: [deployed.listing.id]
              })
            )
          )
        ).toEqual([deployed.listing.id]);

        expect(
          ids(
            await listAllPages(await providerVersionService.listProviderVersions({ instance }))
          )
        ).not.toContain(deployed.version.id);
        expect(
          ids(
            await firstPage(
              await providerVersionService.listProviderVersions({
                instance,
                providerIds: [deployed.provider.id]
              })
            )
          )
        ).toEqual([deployed.version.id]);
      } finally {
        await providerService.updateProvider({
          provider: await loadProvider(deployed),
          input: { isDeprecated: false }
        });
      }
    });

    it('hides it from tenants that only allow trusted providers until it is verified', async () => {
      let scope = await subspaceScopeService.ensureForInstanceUncached({
        id: trusted.ids.instanceId
      });
      let tenant = await tenantService.upsertTenant({
        input: {
          name: scope.tenant.name,
          identifier: scope.tenant.identifier,
          resourceTenantId: scope.tenant.resourceTenantId!,
          resourceTenantIdentifier: scope.tenant.resourceTenantIdentifier!,
          environments: [],
          onlyAllowTrustedProviders: true
        }
      });
      expect(tenant.onlyAllowTrustedProviders).toBe(true);
      let { environment } = scope;

      await expectServiceError(
        providerService.getProviderByIdInternal({
          tenant,
          environment,
          providerId: deployed.provider.id
        }),
        'not_found'
      );
      expect(
        await firstPage(
          await providerService.listProvidersInternal({
            tenant,
            environment,
            ids: [deployed.provider.id]
          })
        )
      ).toEqual([]);
      await expectServiceError(
        providerListingService.getProviderListingByIdInternal({
          tenant,
          environment,
          providerListingId: deployed.listing.id
        }),
        'not_found'
      );
      expect(
        await firstPage(
          await providerListingService.listProviderListingsInternal({
            tenant,
            environment,
            ids: [deployed.listing.id]
          })
        )
      ).toEqual([]);

      await providerService.updateProvider({
        provider: await loadProvider(deployed),
        input: { isVerified: true }
      });

      try {
        expect(
          (
            await providerService.getProviderByIdInternal({
              tenant,
              environment,
              providerId: deployed.provider.id
            })
          ).id
        ).toBe(deployed.provider.id);
        expect(
          ids(
            await firstPage(
              await providerListingService.listProviderListingsInternal({
                tenant,
                environment,
                ids: [deployed.listing.id]
              })
            )
          )
        ).toEqual([deployed.listing.id]);
      } finally {
        await providerService.updateProvider({
          provider: await loadProvider(deployed),
          input: { isVerified: false }
        });
      }
    });
  });
});
