import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { Fabric, type KeyProviderEventKeyProvider } from '@metorial/fabric';
import type { Context } from '@metorial/context';
import type { Organization, OrganizationActor, Project } from '@metorial/db';
import { createSecretsService } from '../lib/secretsService';
import { getTenantForNebula, nebula } from '../nebula';

let secretsKeyProvider = createSecretsService(
  nebula.keyProvider,
  ['get', 'list', 'getSetupInfo', 'validate', 'setDefault', 'import', 'createManaged'],
  () => ({})
);

let secretsKeyProviderError = createSecretsService(
  nebula.keyProviderError,
  ['list'],
  () => ({})
);

export type NebulaKeyProvider = Awaited<ReturnType<typeof secretsKeyProvider.get>> & {
  isMetorialManaged: boolean;
  isDefault?: boolean;
};

let withIsMetorialManaged = (
  keyProvider: Awaited<ReturnType<typeof secretsKeyProvider.get>> & {
    isMetorialManaged?: boolean;
  }
) => ({
  ...keyProvider,
  isMetorialManaged: keyProvider.isMetorialManaged ?? false
});

let withIsDefault = (
  keyProvider: Awaited<ReturnType<typeof secretsKeyProvider.get>> & {
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
  ReturnType<typeof secretsKeyProviderError.list>
>['items'][number];

export type NebulaKeyProviderSetupInfo = Awaited<
  ReturnType<typeof secretsKeyProvider.getSetupInfo>
>;

export type NebulaKeyProviderValidation = Awaited<
  ReturnType<typeof secretsKeyProvider.validate>
>;

let isManagedKeyProvider = (keyProvider: NebulaKeyProvider) => keyProvider.isMetorialManaged;

let listAllKeyProviders = async (d: { organization: Organization; project: Project }) => {
  let items: NebulaKeyProvider[] = [];
  let after: string | undefined;

  while (true) {
    let paginator = await secretsKeyProvider.list({
      organization: d.organization,
      project: d.project
    });

    let result = await paginator.run({
      limit: 100,
      ...(after ? { after } : {})
    });
    items.push(...result.items.map(withIsMetorialManaged));

    if (!result.pagination.hasNextPage || result.items.length === 0) break;

    after = result.items[result.items.length - 1]!.id;
  }

  return items;
};

let countImportedKeyProviders = (keyProviders: NebulaKeyProvider[]) =>
  keyProviders.filter(keyProvider => keyProvider.owner === 'tenant').length;

let countManagedKeyProviders = (keyProviders: NebulaKeyProvider[]) =>
  keyProviders.filter(isManagedKeyProvider).length;

class KeyProviderServiceImpl {
  async listKeyProviders(d: { organization: Organization; project: Project }) {
    let tenant = await getTenantForNebula(d.project);

    return Paginator.create(() => async input => {
      let paginator = await secretsKeyProvider.list({
        organization: d.organization,
        project: d.project
      });
      let result = await paginator.run(input);

      return {
        items: result.items.map(keyProvider =>
          withIsDefault(keyProvider, tenant.defaultKeyProviderId)
        ),
        pagination: result.pagination
      };
    });
  }

  async getKeyProvider(d: {
    organization: Organization;
    project: Project;
    keyProviderId: string;
  }) {
    let tenant = await getTenantForNebula(d.project);

    let keyProvider = await secretsKeyProvider.get({
      organization: d.organization,
      project: d.project,
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
    return await secretsKeyProvider.getSetupInfo({
      organization: d.organization,
      project: d.project,
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
    let validation = await secretsKeyProvider.validate({
      organization: d.organization,
      project: d.project,
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
    await secretsKeyProvider.setDefault({
      organization: d.organization,
      project: d.project,
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
    let keyProviders = await listAllKeyProviders(d);
    let currentCount = countImportedKeyProviders(keyProviders);

    await Fabric.fire('key_provider.imported:before', {
      organization: d.organization,
      project: d.project,
      performedBy: d.performedBy,
      context: d.context,
      currentCount
    });

    let keyProvider = await secretsKeyProvider.import({
      organization: d.organization,
      project: d.project,
      keyInput: d.keyInput
    });
    let updatedTenant = await getTenantForNebula(d.project);

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
    let keyProviders = await listAllKeyProviders(d);
    let currentCount = countManagedKeyProviders(keyProviders);

    await Fabric.fire('key_provider.managed.created:before', {
      organization: d.organization,
      project: d.project,
      performedBy: d.performedBy,
      context: d.context,
      currentCount
    });

    let keyProvider = await secretsKeyProvider.createManaged({
      organization: d.organization,
      project: d.project,
      name: d.name
    });
    let updatedTenant = await getTenantForNebula(d.project);

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
    return Paginator.create(() => async input => {
      let paginator = await secretsKeyProviderError.list({
        organization: d.organization,
        project: d.project,
        keyProviderId: d.keyProviderId
      });
      let result = await paginator.run(input);

      return {
        items: result.items,
        pagination: result.pagination
      };
    });
  }
}

export let keyProviderService = Service.create(
  'keyProviderService',
  () => new KeyProviderServiceImpl()
).build();
