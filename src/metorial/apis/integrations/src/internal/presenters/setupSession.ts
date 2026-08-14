import { shadowId } from '@lowerdeck/shadow-id';
import type {
  Identity,
  IdentityCredential,
  Provider,
  ProviderAuthConfig,
  ProviderAuthCredentials,
  ProviderAuthMethod,
  ProviderConfig,
  ProviderConfigVault,
  ProviderDeployment,
  ProviderListing,
  ProviderSetupSession,
  ProviderSpecification
} from '@metorial-subspace/db';
import { env } from '../../env';
import { getImageUrl } from './utils';

type SetupSessionAuthMethod = ProviderAuthMethod & {
  specification: Omit<ProviderSpecification, 'value'>;
};

type SetupSessionAuthConfig = ProviderAuthConfig & {
  deployment: ProviderDeployment | null;
  authCredentials: ProviderAuthCredentials | null;
  authMethod: SetupSessionAuthMethod;
};

type SetupSessionConfig = ProviderConfig & {
  deployment: ProviderDeployment | null;
  fromVault:
    | (ProviderConfigVault & {
        deployment: ProviderDeployment | null;
      })
    | null;
  specification: Omit<ProviderSpecification, 'value'>;
};

export let providerSetupSessionUrl = (
  providerSetupSession: Pick<ProviderSetupSession, 'id' | 'clientSecret'>
) =>
  `${env.service.INTEGRATIONS_UI_URL}/setup-session/${providerSetupSession.id}?client_secret=${providerSetupSession.clientSecret}`;

export let setupSessionSchemaPresenter = (
  object: 'provider.setup_session.auth_config_schema' | 'provider.setup_session.config_schema',
  schema: { type: 'none' } | { type: 'required'; schema: unknown }
) => ({
  object,
  type: schema.type,
  schema: schema.type === 'required' ? schema.schema : null
});

export let setupSessionProviderListingItemPresenter = (provider: {
  id: string;
  listingId: string;
  name: string;
  description: string | null;
  slug: string;
  image: PrismaJson.EntityImage | null;
  groups: Array<{
    id: string;
    name: string;
  }>;
}) => ({
  object: 'provider.listing#setup_session',

  id: provider.listingId,
  providerId: provider.id,

  name: provider.name,
  description: provider.description,
  slug: provider.slug,
  imageUrl: getImageUrl({
    id: provider.listingId,
    image: provider.image
  }),

  groups: provider.groups.map(group => ({
    object: 'provider.listing.group',
    id: group.id,
    name: group.name
  }))
});

export let setupSessionSelectedProviderPresenter = (
  provider: Provider & {
    listing: ProviderListing | null;
  }
) => ({
  object: 'provider',

  id: provider.id,
  access: provider.access,
  status: provider.status,
  isDeprecated: provider.isDeprecated,

  identifier: provider.identifier,
  globalIdentifier: provider.globalIdentifier,
  tag: provider.tag,

  name: provider.listing?.name ?? provider.name,
  description: provider.listing?.description ?? provider.description,
  slug:
    provider.listing?.prettySlug ??
    provider.listing?.slug ??
    provider.prettySlug ??
    provider.slug,
  metadata: provider.metadata,
  imageUrl: getImageUrl({
    id: provider.listing?.id ?? provider.id,
    image: provider.listing?.image ?? null
  }),

  listing: provider.listing
    ? {
        object: 'provider.listing',

        id: provider.listing.id,
        status: provider.listing.status,
        isDeprecated: provider.listing.isDeprecated,

        isPublic: provider.listing.isPublic,
        isCustomized: provider.listing.isCustomized,

        isMetorial: provider.listing.isMetorial,
        isVerified: provider.listing.isVerified,
        isOfficial: provider.listing.isOfficial,

        name: provider.listing.name,
        description: provider.listing.description,
        slug: provider.listing.prettySlug ?? provider.listing.slug,
        aliases: provider.listing.aliases,
        skills: provider.listing.skills,
        rank: provider.listing.rank,
        imageUrl: getImageUrl({
          id: provider.listing.id,
          image: provider.listing.image
        }),

        deploymentsCount: provider.listing.deploymentsCount,
        providerSessionsCount: provider.listing.providerSessionsCount,
        providerMessagesCount: provider.listing.providerMessagesCount,

        createdAt: provider.listing.createdAt,
        updatedAt: provider.listing.updatedAt
      }
    : null,

  createdAt: provider.createdAt,
  updatedAt: provider.updatedAt
});

export let setupSessionAuthMethodPresenter = (
  providerAuthMethod: SetupSessionAuthMethod & {
    provider: Provider;
  }
) => ({
  object: 'provider.capabilities.auth_method',

  id: providerAuthMethod.id,
  specId: providerAuthMethod.specId,
  specUniqueIdentifier: providerAuthMethod.specUniqueIdentifier,
  callableId: providerAuthMethod.callableId,
  key: providerAuthMethod.key,
  type: providerAuthMethod.type,
  isDefault: providerAuthMethod.isDefault,

  name: providerAuthMethod.name,
  description: providerAuthMethod.description,

  capabilities: providerAuthMethod.value.capabilities,
  inputJsonSchema: providerAuthMethod.value.inputJsonSchema,
  outputJsonSchema: providerAuthMethod.value.outputJsonSchema,

  scopes:
    providerAuthMethod.type === 'oauth'
      ? (providerAuthMethod.value.scopes ?? []).map(scope => ({
          object: 'provider.capabilities.auth_method.scope',
          ...scope,
          scope: scope.id,
          id: shadowId('pamsco_', [providerAuthMethod.id], [scope.id])
        }))
      : null,

  specificationId: providerAuthMethod.specification.id,
  providerId: providerAuthMethod.provider.id,

  createdAt: providerAuthMethod.createdAt,
  updatedAt: providerAuthMethod.updatedAt
});

export let setupSessionAuthCredentialsPresenter = (
  providerAuthCredentials: ProviderAuthCredentials & {
    provider: Provider;
  }
) => ({
  object: 'provider.auth_credentials',

  id: providerAuthCredentials.id,
  type: providerAuthCredentials.type,
  status: providerAuthCredentials.status,
  origin: providerAuthCredentials.origin,

  isEphemeral: providerAuthCredentials.isEphemeral,
  isDefault: providerAuthCredentials.isDefault,
  isAutoRegistration: providerAuthCredentials.isAutoRegistration,
  isManaged: providerAuthCredentials.origin !== 'tenant_created',
  needsScopeSync: providerAuthCredentials.needsScopeSync,

  providerId: providerAuthCredentials.provider.id,

  name: providerAuthCredentials.name,
  description: providerAuthCredentials.description,
  metadata: providerAuthCredentials.metadata,
  scopes: providerAuthCredentials.scopes ?? null,

  createdAt: providerAuthCredentials.createdAt,
  updatedAt: providerAuthCredentials.updatedAt
});

export let setupSessionDeploymentPreviewPresenter = (
  providerDeployment: ProviderDeployment & {
    provider: Provider;
  }
) => ({
  object: 'provider.deployment#preview',

  id: providerDeployment.id,
  status: providerDeployment.status,

  isEphemeral: providerDeployment.isEphemeral,
  isDefault: providerDeployment.isDefault,

  name: providerDeployment.name,
  description: providerDeployment.description,
  metadata: providerDeployment.metadata,
  toolFilter: providerDeployment.toolFilter,

  providerId: providerDeployment.provider.id,

  createdAt: providerDeployment.createdAt,
  updatedAt: providerDeployment.updatedAt
});

export let setupSessionConfigVaultPreviewPresenter = (
  providerConfigVault: ProviderConfigVault & {
    provider: Provider;
    deployment: ProviderDeployment | null;
  }
) => ({
  object: 'provider.config_vault#preview',

  id: providerConfigVault.id,
  status: providerConfigVault.status,

  name: providerConfigVault.name,
  description: providerConfigVault.description,
  metadata: providerConfigVault.metadata,

  providerId: providerConfigVault.provider.id,

  deployment: providerConfigVault.deployment
    ? setupSessionDeploymentPreviewPresenter({
        ...providerConfigVault.deployment,
        provider: providerConfigVault.provider
      })
    : null,

  createdAt: providerConfigVault.createdAt,
  updatedAt: providerConfigVault.updatedAt
});

export let setupSessionConfigPresenter = (
  providerConfig: SetupSessionConfig & {
    provider: Provider;
  }
) => ({
  object: 'provider.config',

  id: providerConfig.id,
  status: providerConfig.status,

  isEphemeral: providerConfig.isEphemeral,
  isDefault: providerConfig.isDefault,
  isForVault: providerConfig.isForVault,

  name: providerConfig.name,
  description: providerConfig.description,
  metadata: providerConfig.metadata,
  toolFilter: providerConfig.toolFilter,

  providerId: providerConfig.provider.id,
  specificationId: providerConfig.specification.id,

  deployment: providerConfig.deployment
    ? setupSessionDeploymentPreviewPresenter({
        ...providerConfig.deployment,
        provider: providerConfig.provider
      })
    : null,

  fromVault: providerConfig.fromVault
    ? setupSessionConfigVaultPreviewPresenter({
        ...providerConfig.fromVault,
        provider: providerConfig.provider
      })
    : null,

  createdAt: providerConfig.createdAt,
  updatedAt: providerConfig.updatedAt
});

export let setupSessionAuthConfigPresenter = (
  providerAuthConfig: SetupSessionAuthConfig & {
    provider: Provider;
  }
) => ({
  object: 'provider.auth_config',

  id: providerAuthConfig.id,
  type: providerAuthConfig.type,
  source: providerAuthConfig.source,
  status: providerAuthConfig.status,

  isEphemeral: providerAuthConfig.isEphemeral,
  isDefault: providerAuthConfig.isDefault,

  providerId: providerAuthConfig.provider.id,

  name: providerAuthConfig.name,
  description: providerAuthConfig.description,
  metadata: providerAuthConfig.metadata,
  scopes: providerAuthConfig.scopes,
  toolFilter: providerAuthConfig.toolFilter,

  deployment: providerAuthConfig.deployment
    ? setupSessionDeploymentPreviewPresenter({
        ...providerAuthConfig.deployment,
        provider: providerAuthConfig.provider
      })
    : null,

  credentials: providerAuthConfig.authCredentials
    ? setupSessionAuthCredentialsPresenter({
        ...providerAuthConfig.authCredentials,
        provider: providerAuthConfig.provider
      })
    : null,

  authMethod: setupSessionAuthMethodPresenter({
    ...providerAuthConfig.authMethod,
    provider: providerAuthConfig.provider
  }),

  createdAt: providerAuthConfig.createdAt,
  updatedAt: providerAuthConfig.updatedAt
});

export let setupSessionPresenter = (
  providerSetupSession: ProviderSetupSession & {
    identity: Identity | null;
    identityCredential: IdentityCredential | null;
    authConfig: SetupSessionAuthConfig | null;
    config: SetupSessionConfig | null;
    deployment: ProviderDeployment | null;
    provider: Provider | null;
    authMethod: SetupSessionAuthMethod | null;
    authCredentials: ProviderAuthCredentials | null;
  }
) => {
  let status =
    providerSetupSession.status === 'pending' && providerSetupSession.expiresAt <= new Date()
      ? ('expired' as const)
      : providerSetupSession.status;

  return {
    object: 'provider.setup_session',

    id: providerSetupSession.id,
    type: providerSetupSession.typeSelected,
    typeSelected: providerSetupSession.typeSelected,
    typeConcrete: providerSetupSession.typeConcrete,

    status,

    name: providerSetupSession.name,
    description: providerSetupSession.description,
    metadata: providerSetupSession.metadata,

    providerId: providerSetupSession.provider?.id ?? null,
    identityId: providerSetupSession.identity?.id ?? null,
    identityCredentialId: providerSetupSession.identityCredential?.id ?? null,
    configuration: providerSetupSession.configuration ?? null,

    authMethod:
      providerSetupSession.provider && providerSetupSession.authMethod
        ? setupSessionAuthMethodPresenter({
            ...providerSetupSession.authMethod,
            provider: providerSetupSession.provider
          })
        : null,

    deployment:
      providerSetupSession.deployment && providerSetupSession.provider
        ? setupSessionDeploymentPreviewPresenter({
            ...providerSetupSession.deployment,
            provider: providerSetupSession.provider
          })
        : null,

    credentials:
      providerSetupSession.authCredentials && providerSetupSession.provider
        ? setupSessionAuthCredentialsPresenter({
            ...providerSetupSession.authCredentials,
            provider: providerSetupSession.provider
          })
        : null,

    authConfig:
      providerSetupSession.authConfig && providerSetupSession.provider
        ? setupSessionAuthConfigPresenter({
            ...providerSetupSession.authConfig,
            provider: providerSetupSession.provider
          })
        : null,

    config:
      providerSetupSession.config && providerSetupSession.provider
        ? setupSessionConfigPresenter({
            ...providerSetupSession.config,
            provider: providerSetupSession.provider
          })
        : null,

    uiMode: providerSetupSession.uiMode,
    redirectUrl: providerSetupSession.redirectUrl,

    createdAt: providerSetupSession.createdAt,
    updatedAt: providerSetupSession.updatedAt,
    expiresAt: providerSetupSession.expiresAt
  };
};
