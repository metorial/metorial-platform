import {
  type BootstrappedOrganization,
  createRemoteProvider,
  eventually,
  expectOk,
  uniqueId
} from '@metorial/e2e';
import { loadOrganizationFixture, subspaceDb } from '@metorial/e2e/db';
import {
  getId,
  ID,
  type ProviderAuthCredentials,
  type ProviderDeployment
} from '@metorial-subspace/db';
import { providerDeploymentInternalService } from '@metorial-subspace/module-provider-internal';
import { resolveMetorialFacing } from '@metorial-subspace/module-tenant';
import { addMinutes } from 'date-fns';
import { providerAuthConfigInternalService } from '../src/services/providerAuthConfigInternal';

export let importContext = { ip: '127.0.0.1', ua: 'metorial-e2e' };

export type AuthScope = Awaited<ReturnType<typeof loadAuthScope>>;

export type AuthProvider = Awaited<ReturnType<typeof loadProvider>>;

export type SeededAuthMethod = Awaited<ReturnType<typeof seedAuthMethod>>;

export let loadAuthScope = async (org: BootstrappedOrganization) => {
  let fixture = await loadOrganizationFixture(org.ids);
  let { tenant, environment, solution } = await resolveMetorialFacing({
    instance: fixture.instance
  });

  return { fixture, instance: fixture.instance, tenant, environment, solution };
};

export let loadFreshTenant = async (scope: AuthScope) =>
  await subspaceDb.tenant.findUniqueOrThrow({ where: { oid: scope.tenant.oid } });

export let loadProvider = async (providerId: string) =>
  await subspaceDb.provider.findUniqueOrThrow({
    where: { id: providerId },
    include: { defaultVariant: true, type: true }
  });

export let createAuthProvider = async (org: BootstrappedOrganization, url: string) => {
  let remote = await createRemoteProvider(org.clients.instance, { url });
  return await loadProvider(remote.providerId);
};

export let createProviderDeployment = async (
  org: BootstrappedOrganization,
  provider: AuthProvider
) => {
  let deployment = expectOk(
    await org.clients.instance.post('/provider-deployments', {
      provider_id: provider.id,
      name: uniqueId('deployment')
    })
  );

  return await loadProviderDeployment(deployment.id);
};

export let loadProviderDeployment = async (providerDeploymentId: string) =>
  await subspaceDb.providerDeployment.findUniqueOrThrow({
    where: { id: providerDeploymentId },
    include: {
      provider: true,
      providerVariant: true,
      currentVersion: { include: { lockedVersion: true } }
    }
  });

export let loadDiscoveredVersion = async (scope: AuthScope, provider: AuthProvider) =>
  await eventually(
    async () => {
      let version = await providerDeploymentInternalService.getCurrentVersionOptional({
        provider,
        environment: scope.environment
      });
      if (!version?.specificationOid) {
        throw new Error(`Provider ${provider.id} has no discovered specification yet`);
      }
      return { ...version, specificationOid: version.specificationOid };
    },
    { timeoutMs: 60_000, intervalMs: 500 }
  );

export let seedAuthMethod = async (
  scope: AuthScope,
  provider: AuthProvider,
  input: { type: 'token' | 'oauth'; isDefault: boolean }
) => {
  let version = await loadDiscoveredVersion(scope, provider);
  let key = uniqueId(`e2e-${input.type}`);

  let global = await subspaceDb.providerAuthMethodGlobal.create({
    data: {
      ...getId('providerAuthMethodGlobal'),
      key,
      providerOid: provider.oid
    }
  });

  return await subspaceDb.providerAuthMethod.create({
    data: {
      ...getId('providerAuthMethod'),
      specId: `e2e::${key}`,
      specUniqueIdentifier: `e2e::${key}`,
      callableId: key,
      key,
      type: input.type,
      isDefault: input.isDefault,
      name: `E2E ${input.type}`,
      value: {
        specId: `e2e::${key}`,
        callableId: key,
        key,
        type: input.type,
        name: `E2E ${input.type}`,
        inputJsonSchema: {
          type: 'object',
          properties: { accessToken: { type: 'string' } },
          required: ['accessToken']
        },
        capabilities: {},
        scopes: [],
        metadata: {}
      },
      hash: key,
      providerOid: provider.oid,
      specificationOid: version.specificationOid,
      globalOid: global.oid
    }
  });
};

export let seedAuthConfig = async (
  scope: AuthScope,
  provider: AuthProvider,
  authMethod: SeededAuthMethod,
  input: {
    name?: string;
    description?: string;
    metadata?: Record<string, any>;
    isEphemeral?: boolean;
    isDefault?: boolean;
    type?: 'manual' | 'oauth_manual' | 'oauth_automated';
    credentials?: ProviderAuthCredentials;
    providerDeployment?: ProviderDeployment;
  } = {}
) => {
  let backend = await subspaceDb.backend.findUniqueOrThrow({
    where: { oid: provider.defaultVariant!.backendOid }
  });

  return await providerAuthConfigInternalService.createProviderAuthConfigInternal({
    tenant: scope.tenant,
    environment: scope.environment,
    provider,
    providerDeployment: input.providerDeployment,
    backend,
    type: input.type ?? 'manual',
    source: 'manual',
    credentials: input.credentials,
    import: { ...importContext, note: 'seeded' },
    input: {
      name: input.name ?? uniqueId('auth-config'),
      description: input.description,
      metadata: input.metadata,
      isEphemeral: input.isEphemeral,
      isDefault: input.isDefault
    },
    authMethod,
    backendProviderAuthConfig: { expiresAt: null }
  });
};

export let seedCredentials = async (
  scope: AuthScope,
  provider: AuthProvider,
  input: { name?: string; isEphemeral?: boolean } = {}
) =>
  await subspaceDb.providerAuthCredentials.create({
    data: {
      ...getId('providerAuthCredentials'),
      type: 'oauth',
      status: 'active',
      origin: 'tenant_created',
      isEphemeral: !!input.isEphemeral,
      isDefault: false,
      isAutoRegistration: false,
      name: input.name ?? uniqueId('credentials'),
      tenantOid: scope.tenant.oid,
      projectOid: scope.tenant.projectOid,
      environmentOid: scope.environment.oid,
      instanceOid: scope.environment.instanceOid,
      solutionOid: scope.solution.oid,
      providerOid: provider.oid,
      backendOid: provider.defaultVariant!.backendOid
    }
  });

export let seedOAuthSetup = async (
  scope: AuthScope,
  provider: AuthProvider,
  input: {
    authMethod: SeededAuthMethod;
    credentials: ProviderAuthCredentials;
    expiresAt?: Date;
    name?: string;
    isEphemeral?: boolean;
  }
) =>
  await subspaceDb.providerOAuthSetup.create({
    data: {
      ...getId('providerOAuthSetup'),
      clientSecret: await ID.generateId('providerOAuthSetup_clientSecret'),
      status: 'unused',
      isEphemeral: !!input.isEphemeral,
      name: input.name ?? uniqueId('oauth-setup'),
      backendUrl: 'https://idp.e2e.invalid/authorize',
      authCredentialsOid: input.credentials.oid,
      authMethodOid: input.authMethod.oid,
      tenantOid: scope.tenant.oid,
      projectOid: scope.tenant.projectOid,
      environmentOid: scope.environment.oid,
      instanceOid: scope.environment.instanceOid,
      solutionOid: scope.solution.oid,
      providerOid: provider.oid,
      expiresAt: input.expiresAt ?? addMinutes(new Date(), 30)
    }
  });
