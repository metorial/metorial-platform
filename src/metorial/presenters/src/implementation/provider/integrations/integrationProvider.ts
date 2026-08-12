import { v } from '@lowerdeck/validation';
import type { Prisma as SubspacePrisma } from '@metorial-subspace/db';
import { Presenter } from '@metorial/presenter';
import type { integrationProviderInclude } from '@metorial-subspace/module-integration';
import { integrationProviderType } from '../../../types';
import { toolFilterPresenter } from '../../_shared/toolFilter';
import { v1ProviderAuthCredentialsPresenter, v1ProviderAuthMethodPresenter } from '../auth';
import {
  v1ProviderConfigPreviewPresenter,
  v1ProviderDeploymentPreviewPresenter
} from '../config';
import { v1ProviderPreview } from '../provider';

let presentToolFilter = (toolFilter: PrismaJson.ToolFilter | null | undefined) =>
  toolFilter ? toolFilterPresenter(toolFilter) : null;

type RawIntegrationProvider = SubspacePrisma.IntegrationProviderGetPayload<{
  include: typeof integrationProviderInclude;
}>;
type RawIntegrationProviderVersion = NonNullable<RawIntegrationProvider['currentVersion']>;

let requireCurrentVersion = (integrationProvider: RawIntegrationProvider) => {
  if (!integrationProvider.currentVersion) {
    throw new Error(
      `Integration provider "${integrationProvider.id}" has no current version to present.`
    );
  }

  return integrationProvider.currentVersion;
};

export let v1IntegrationProviderSnapshot = Object.assign(
  async (
    integrationProvider: RawIntegrationProvider,
    version: RawIntegrationProviderVersion,
    opts?: any
  ) => {
    let provider = integrationProvider.provider;
    return {
      object: 'integration.provider#snapshot' as const,
      id: integrationProvider.id,

      provider_version: {
        object: 'integration.provider.version' as const,
        id: version.id,
        index: version.index
      },

      status: version.status,
      name: integrationProvider.name,
      description: integrationProvider.description,
      metadata: integrationProvider.metadata,
      tool_filter: presentToolFilter(version.toolFilter),
      provider_id: provider.id,
      deployment_id: version.deployment.id,
      auth_method_id: version.authMethod?.id ?? null,
      auth_credentials_id: version.authCredentials?.id ?? null,
      config: version.config
        ? await v1ProviderConfigPreviewPresenter
            .present({ config: { ...version.config, provider } }, opts)
            .run()
        : null,
      created_at: version.createdAt,
      updated_at: version.createdAt,
      archived_at:
        integrationProvider.status === 'archived'
          ? new Date(
              Math.min(
                version.createdAt.getTime(),
                integrationProvider.archivedAt?.getTime() ?? Infinity
              )
            )
          : null
    };
  },
  {
    schema: v.object({
      object: v.literal('integration.provider#snapshot'),
      id: v.string(),
      provider_version: v.object({
        object: v.literal('integration.provider.version'),
        id: v.string(),
        index: v.number()
      }),
      status: v.enumOf(['active', 'archived', 'deleted']),
      name: v.string(),
      description: v.nullable(v.string()),
      metadata: v.nullable(v.record(v.any())),
      tool_filter: v.nullable(toolFilterPresenter.schema),
      provider_id: v.string(),
      deployment_id: v.string(),
      auth_method_id: v.nullable(v.string()),
      auth_credentials_id: v.nullable(v.string()),
      config: v.nullable(v1ProviderConfigPreviewPresenter.schema),
      created_at: v.date(),
      updated_at: v.date(),
      archived_at: v.nullable(v.date())
    })
  }
);

export let dashboardIntegrationProviderSnapshot = Object.assign(
  async (
    integrationProvider: RawIntegrationProvider,
    version: RawIntegrationProviderVersion,
    opts?: any
  ) => {
    let provider = integrationProvider.provider;
    let inner = await v1IntegrationProviderSnapshot(integrationProvider, version, opts);

    return {
      ...inner,

      provider: v1ProviderPreview(provider),
      deployment: await v1ProviderDeploymentPreviewPresenter
        .present({ deployment: { ...version.deployment, provider } }, opts)
        .run(),
      auth_method: version.authMethod
        ? await v1ProviderAuthMethodPresenter
            .present({ authMethod: { ...version.authMethod, provider } }, opts)
            .run()
        : null,
      auth_credentials: version.authCredentials
        ? await v1ProviderAuthCredentialsPresenter
            .present({ authCredentials: { ...version.authCredentials, provider } }, opts)
            .run()
        : null
    };
  },
  {
    schema: v.object({
      ...v1IntegrationProviderSnapshot.schema.properties,
      provider: v1ProviderPreview.schema,
      deployment: v1ProviderDeploymentPreviewPresenter.schema,
      auth_method: v.nullable(v1ProviderAuthMethodPresenter.schema),
      auth_credentials: v.nullable(v1ProviderAuthCredentialsPresenter.schema)
    }) as any
  }
);

export let v1IntegrationProviderPresenter = Presenter.create(integrationProviderType)
  .presenter(async ({ integrationProvider }, opts) => {
    let version = requireCurrentVersion(integrationProvider);

    return {
      object: 'integration.provider' as const,
      id: integrationProvider.id,
      status: integrationProvider.status,
      integration_id: integrationProvider.integration.id,
      name: integrationProvider.name,
      description: integrationProvider.description,
      metadata: integrationProvider.metadata,
      tool_filter: presentToolFilter(version.toolFilter),
      provider_id: integrationProvider.provider.id,
      deployment_id: version.deployment.id,
      auth_method_id: version.authMethod?.id ?? null,
      auth_credentials_id: version.authCredentials?.id ?? null,
      config: version.config
        ? await v1ProviderConfigPreviewPresenter
            .present(
              {
                config: {
                  ...version.config,
                  provider: integrationProvider.provider
                }
              },
              opts
            )
            .run()
        : null,
      created_at: integrationProvider.createdAt,
      updated_at: integrationProvider.updatedAt,
      archived_at: integrationProvider.archivedAt
    };
  })
  .schema(
    v.object({
      object: v.literal('integration.provider'),
      id: v.string(),
      status: v.enumOf(['active', 'archived', 'deleted']),
      integration_id: v.string(),
      name: v.string(),
      description: v.nullable(v.string()),
      metadata: v.nullable(v.record(v.any())),
      tool_filter: v.nullable(toolFilterPresenter.schema),
      provider_id: v.string(),
      deployment_id: v.string(),
      auth_method_id: v.nullable(v.string()),
      auth_credentials_id: v.nullable(v.string()),
      config: v.nullable(v1ProviderConfigPreviewPresenter.schema),
      created_at: v.date(),
      updated_at: v.date(),
      archived_at: v.nullable(v.date())
    })
  )
  .build();

export let dashboardIntegrationProviderPresenter = Presenter.create(integrationProviderType)
  .presenter(async ({ integrationProvider }, opts) => {
    let version = requireCurrentVersion(integrationProvider);
    let inner = await v1IntegrationProviderPresenter
      .present({ integrationProvider }, opts)
      .run();

    return {
      ...inner,
      provider: v1ProviderPreview(integrationProvider.provider),
      deployment: await v1ProviderDeploymentPreviewPresenter
        .present(
          {
            deployment: {
              ...version.deployment,
              provider: integrationProvider.provider
            }
          },
          opts
        )
        .run(),
      auth_method: version.authMethod
        ? await v1ProviderAuthMethodPresenter
            .present(
              {
                authMethod: {
                  ...version.authMethod,
                  provider: integrationProvider.provider
                }
              },
              opts
            )
            .run()
        : null,
      auth_credentials: version.authCredentials
        ? await v1ProviderAuthCredentialsPresenter
            .present(
              {
                authCredentials: {
                  ...version.authCredentials,
                  provider: integrationProvider.provider
                }
              },
              opts
            )
            .run()
        : null
    };
  })
  .schema(
    v.object({
      ...v1IntegrationProviderPresenter.schema.properties,
      object: v.literal('integration.provider'),
      id: v.string(),
      status: v.enumOf(['active', 'archived', 'deleted']),
      integration_id: v.string(),
      name: v.string(),
      description: v.nullable(v.string()),
      metadata: v.nullable(v.record(v.any())),
      tool_filter: v.nullable(toolFilterPresenter.schema),
      provider: v1ProviderPreview.schema,
      deployment: v1ProviderDeploymentPreviewPresenter.schema,
      auth_method: v.nullable(v1ProviderAuthMethodPresenter.schema),
      auth_credentials: v.nullable(v1ProviderAuthCredentialsPresenter.schema)
    }) as any
  )
  .build();
