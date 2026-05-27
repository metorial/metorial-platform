import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { Fabric, type KeyProviderEventKeyProvider } from '@metorial/fabric';
import type { Context } from '@metorial/context';
import type { Organization, OrganizationActor, Project } from '@metorial/db';
import { nebula } from '../nebula';
import { getNebulaTenantForProject } from '../tenant';

export type NebulaKeyProvider = Awaited<ReturnType<typeof nebula.keyProvider.get>> & {
  isMetorialManaged: boolean;
  isDefault?: boolean;
};

let withIsMetorialManaged = (
  keyProvider: Awaited<ReturnType<typeof nebula.keyProvider.get>> & {
    isMetorialManaged?: boolean;
  }
) => ({
  ...keyProvider,
  isMetorialManaged: keyProvider.isMetorialManaged ?? false
});

let withIsDefault = (
  keyProvider: Awaited<ReturnType<typeof nebula.keyProvider.get>> & {
    isMetorialManaged?: boolean;
  },
  defaultKeyProviderId: string | null
): NebulaKeyProvider => ({
  ...withIsMetorialManaged(keyProvider),
  isDefault: !!defaultKeyProviderId && keyProvider.id === defaultKeyProviderId
});

let toFabricKeyProvider = (keyProvider: NebulaKeyProvider): KeyProviderEventKeyProvider => ({
  object: 'nebula#key_provider',
  id: keyProvider.id,
  name: keyProvider.name,
  type: keyProvider.type,
  owner: keyProvider.owner,
  status: keyProvider.status,
  isMetorialManaged: keyProvider.isMetorialManaged,
  keyReuseTimeSeconds: keyProvider.keyReuseTimeSeconds,
  keyInfo: keyProvider.keyInfo,
  createdAt: keyProvider.createdAt,
  updatedAt: keyProvider.updatedAt
});

export type NebulaKeyProviderError = Awaited<
  ReturnType<typeof nebula.keyProviderError.list>
>['items'][number];

export type NebulaKeyProviderSetupInfo = Awaited<
  ReturnType<typeof nebula.keyProvider.getSetupInfo>
>;

export type NebulaKeyProviderValidation = Awaited<
  ReturnType<typeof nebula.keyProvider.validate>
>;

let isManagedKeyProvider = (keyProvider: NebulaKeyProvider) => keyProvider.isMetorialManaged;

let listAllKeyProviders = async (tenantId: string) => {
  let items: NebulaKeyProvider[] = [];
  let after: string | undefined;

  while (true) {
    let page = await nebula.keyProvider.list({
      tenantId,
      limit: 100,
      ...(after ? { after } : {})
    });

    items.push(...page.items.map(withIsMetorialManaged));

    if (!page.pagination.has_more_after || page.items.length === 0) break;

    after = page.items[page.items.length - 1]!.id;
  }

  return items;
};

let countImportedKeyProviders = (keyProviders: NebulaKeyProvider[]) =>
  keyProviders.filter(keyProvider => keyProvider.owner === 'tenant').length;

let countManagedKeyProviders = (keyProviders: NebulaKeyProvider[]) =>
  keyProviders.filter(isManagedKeyProvider).length;

class KeyProviderServiceImpl {
  async listKeyProviders(d: { organization: Organization; project: Project }) {
    let tenant = await getNebulaTenantForProject(d);

    return Paginator.create(() => async input => {
      let result = await nebula.keyProvider.list({
        tenantId: tenant.id,
        ...input
      });

      return {
        items: result.items.map(keyProvider =>
          withIsDefault(keyProvider, tenant.defaultKeyProviderId)
        ),
        pagination: {
          hasNextPage: result.pagination.has_more_after,
          hasPreviousPage: result.pagination.has_more_before
        }
      };
    });
  }

  async getKeyProvider(d: {
    organization: Organization;
    project: Project;
    keyProviderId: string;
  }) {
    let tenant = await getNebulaTenantForProject(d);

    let keyProvider = await nebula.keyProvider.get({
      tenantId: tenant.id,
      keyProviderId: d.keyProviderId
    });

    return withIsDefault(keyProvider, tenant.defaultKeyProviderId);
  }

  async getSetupInfo(d: {
    organization: Organization;
    project: Project;
    input: {
      region?: string;
      keyId?: string;
    };
  }) {
    let tenant = await getNebulaTenantForProject(d);

    return await nebula.keyProvider.getSetupInfo({
      tenantId: tenant.id,
      region: d.input.region,
      keyId: d.input.keyId
    });
  }

  async validateKeyProvider(d: {
    organization: Organization;
    project: Project;
    performedBy: OrganizationActor;
    context?: Context;
    keyProviderId: string;
  }) {
    let tenant = await getNebulaTenantForProject(d);

    let validation = await nebula.keyProvider.validate({
      tenantId: tenant.id,
      keyProviderId: d.keyProviderId
    });
    let keyProvider = await this.getKeyProvider(d);

    await Fabric.fire('key_provider.validated:after', {
      organization: d.organization,
      project: d.project,
      performedBy: d.performedBy,
      context: d.context,
      keyProvider: toFabricKeyProvider(keyProvider),
      validation: {
        object: 'key_provider_validation',
        keyProviderId: validation.keyProviderId,
        description: validation.description
      }
    });

    return validation;
  }

  async setDefaultKeyProvider(d: {
    organization: Organization;
    project: Project;
    performedBy: OrganizationActor;
    context?: Context;
    keyProviderId: string;
  }) {
    let tenant = await getNebulaTenantForProject(d);

    await nebula.keyProvider.setDefault({
      tenantId: tenant.id,
      keyProviderId: d.keyProviderId
    });

    let keyProvider = await this.getKeyProvider(d);

    await Fabric.fire('key_provider.default.set:after', {
      organization: d.organization,
      project: d.project,
      performedBy: d.performedBy,
      context: d.context,
      keyProvider: toFabricKeyProvider(keyProvider)
    });

    return keyProvider;
  }

  async importKeyProvider(d: {
    organization: Organization;
    project: Project;
    performedBy: OrganizationActor;
    context?: Context;
    keyInput: Record<string, unknown>;
  }) {
    let tenant = await getNebulaTenantForProject(d);
    let keyProviders = await listAllKeyProviders(tenant.id);
    let currentCount = countImportedKeyProviders(keyProviders);

    await Fabric.fire('key_provider.imported:before', {
      organization: d.organization,
      project: d.project,
      performedBy: d.performedBy,
      context: d.context,
      currentCount
    });

    let keyProvider = await nebula.keyProvider.import({
      tenantId: tenant.id,
      keyInput: d.keyInput
    });
    let updatedTenant = await getNebulaTenantForProject(d);

    await Fabric.fire('key_provider.imported:after', {
      organization: d.organization,
      project: d.project,
      performedBy: d.performedBy,
      context: d.context,
      keyProvider: toFabricKeyProvider(
        withIsDefault(keyProvider, updatedTenant.defaultKeyProviderId)
      )
    });

    return withIsDefault(keyProvider, updatedTenant.defaultKeyProviderId);
  }

  async createManagedKeyProvider(d: {
    organization: Organization;
    project: Project;
    performedBy: OrganizationActor;
    context?: Context;
    name: string;
  }) {
    let tenant = await getNebulaTenantForProject(d);
    let keyProviders = await listAllKeyProviders(tenant.id);
    let currentCount = countManagedKeyProviders(keyProviders);

    await Fabric.fire('key_provider.managed.created:before', {
      organization: d.organization,
      project: d.project,
      performedBy: d.performedBy,
      context: d.context,
      currentCount
    });

    let keyProvider = await nebula.keyProvider.createManaged({
      tenantId: tenant.id,
      name: d.name
    });
    let updatedTenant = await getNebulaTenantForProject(d);

    await Fabric.fire('key_provider.managed.created:after', {
      organization: d.organization,
      project: d.project,
      performedBy: d.performedBy,
      context: d.context,
      keyProvider: toFabricKeyProvider(
        withIsDefault(keyProvider, updatedTenant.defaultKeyProviderId)
      )
    });

    return withIsDefault(keyProvider, updatedTenant.defaultKeyProviderId);
  }

  async listKeyProviderErrors(d: {
    organization: Organization;
    project: Project;
    keyProviderId: string;
  }) {
    let tenant = await getNebulaTenantForProject(d);

    return Paginator.create(() => async input => {
      let result = await nebula.keyProviderError.list({
        tenantId: tenant.id,
        keyProviderId: d.keyProviderId,
        ...input
      });

      return {
        items: result.items,
        pagination: {
          hasNextPage: result.pagination.has_more_after,
          hasPreviousPage: result.pagination.has_more_before
        }
      };
    });
  }
}

export let keyProviderService = Service.create(
  'keyProviderService',
  () => new KeyProviderServiceImpl()
).build();
