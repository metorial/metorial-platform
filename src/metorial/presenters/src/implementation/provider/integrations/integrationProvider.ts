import { v } from '@lowerdeck/validation';
import type { Prisma as SubspacePrisma } from '@metorial-subspace/db';
import { Presenter } from '@metorial/presenter';
import type { integrationProviderInclude } from '@metorial-subspace/module-integration';
import { integrationProviderType } from '../../../types';
import { toolFilterPresenter } from '../../_shared/toolFilter';
import {
  effectiveProviderAuthMethodSchema,
  v1ProviderAuthCredentialsPresenter,
  v1ProviderAuthMethodPresenter,
  withEffectiveAuthMethodCapabilities
} from '../auth';
import { dashboardCallbackPresenter } from '../callbacks/callback';
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

// Instance-provider payloads pass the snapshotted version explicitly and never load callbacks.
type RawIntegrationProviderSnapshot = Omit<
  RawIntegrationProvider,
  'callbacks' | 'currentVersion'
>;

let activeCallback = (integrationProvider: RawIntegrationProvider) =>
  integrationProvider.callbacks.at(0) ?? null;

let integrationProviderCallbacks = Object.assign(
  (integrationProvider: RawIntegrationProvider) => ({
    object: 'integration.provider.callbacks' as const,
    status: integrationProvider.areCallbacksEnabled
      ? ('enabled' as const)
      : ('disabled' as const),
    callback_id: activeCallback(integrationProvider)?.id ?? null
  }),
  {
    properties: {
      object: v.literal('integration.provider.callbacks', {
        description: 'String representing the object’s type.'
      }),

      status: v.enumOf(['enabled', 'disabled'], {
        name: 'status',
        description:
          'Enabling registers a callback against every matching integration instance. Disabling tears it down again. Only providers whose type reports `triggers.status` as `enabled` can enable callbacks.'
      }),

      callback_id: v.nullable(
        v.string({
          name: 'callback_id',
          description:
            'The active callback, once it has been created. Null while callbacks are disabled.',
          examples: ['cbk_4dEfGhJkLmNpQrSt']
        })
      )
    }
  }
);

let presentIntegrationProviderVersionRelations = Object.assign(
  async (
    integrationProvider: RawIntegrationProviderSnapshot,
    version: RawIntegrationProviderVersion,
    opts?: any
  ) => {
    let provider = integrationProvider.provider;

    return {
      provider: v1ProviderPreview(provider),
      deployment: await v1ProviderDeploymentPreviewPresenter
        .present({ deployment: { ...version.deployment, provider } }, opts)
        .run(),
      auth_method: version.authMethod
        ? await v1ProviderAuthMethodPresenter
            .present(
              {
                authMethod: {
                  ...withEffectiveAuthMethodCapabilities(
                    version.authMethod,
                    version.deployment
                  ),
                  provider
                }
              },
              opts
            )
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
    properties: {
      provider: v1ProviderPreview.schema,
      deployment: v1ProviderDeploymentPreviewPresenter.schema,
      auth_method: v.nullable(effectiveProviderAuthMethodSchema),
      auth_credentials: v.nullable(v1ProviderAuthCredentialsPresenter.schema)
    }
  }
);

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
    integrationProvider: RawIntegrationProviderSnapshot,
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
      object: v.literal('integration.provider#snapshot', {
        description: 'String representing the object’s type.'
      }),
      id: v.string({
        description: 'Unique ID.',
        examples: ['inp_3cDeFgHjKlMnPqRs']
      }),
      provider_version: v.object(
        {
          object: v.literal('integration.provider.version', {
            description: 'String representing the object’s type.'
          }),
          id: v.string({
            description: 'Unique ID.'
          }),
          index: v.number({
            description: 'Position of this version, starting at 0.'
          })
        },
        { description: 'Version this snapshot was taken from.' }
      ),
      status: v.enumOf(['active', 'archived', 'deleted'], {
        description: '`archived` once you archive the integration provider.'
      }),
      name: v.string({
        description: 'Display name.'
      }),
      description: v.nullable(
        v.string({
          description: 'Free-text description.'
        })
      ),
      metadata: v.nullable(
        v.record(v.any(), {
          description: 'Custom data you attach to identify or organize this record.'
        })
      ),
      tool_filter: v.nullable(toolFilterPresenter.schema),
      provider_id: v.string({
        description: 'Provider this snapshot was taken from.'
      }),
      deployment_id: v.string({
        description: 'Deployment this snapshot was taken from.'
      }),
      auth_method_id: v.nullable(
        v.string({
          description: 'Auth method at snapshot time. `null` when none was set.'
        })
      ),
      auth_credentials_id: v.nullable(
        v.string({
          description: 'Credentials at snapshot time. `null` when none were set.'
        })
      ),
      config: v.nullable(v1ProviderConfigPreviewPresenter.schema),
      created_at: v.date({
        description: 'Creation time.'
      }),
      updated_at: v.date(),
      archived_at: v.nullable(
        v.date({
          description: 'When this was archived. `null` while active.'
        })
      )
    })
  }
);

export let dashboardIntegrationProviderSnapshot = Object.assign(
  async (
    integrationProvider: RawIntegrationProviderSnapshot,
    version: RawIntegrationProviderVersion,
    opts?: any
  ) => {
    let inner = await v1IntegrationProviderSnapshot(integrationProvider, version, opts);

    return {
      ...inner,
      ...(await presentIntegrationProviderVersionRelations(integrationProvider, version, opts))
    };
  },
  {
    schema: v.object({
      ...v1IntegrationProviderSnapshot.schema.properties,
      ...presentIntegrationProviderVersionRelations.properties
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
      callbacks: integrationProviderCallbacks(integrationProvider),
      created_at: integrationProvider.createdAt,
      updated_at: integrationProvider.updatedAt,
      archived_at: integrationProvider.archivedAt
    };
  })
  .schema(
    v.object({
      object: v.literal('integration.provider', {
        description: 'String representing the object’s type.'
      }),
      id: v.string({
        description: 'Unique ID.',
        examples: ['inp_3cDeFgHjKlMnPqRs']
      }),
      status: v.enumOf(['active', 'archived', 'deleted'], {
        description: '`archived` once you archive the integration provider.'
      }),
      integration_id: v.string({
        description: 'Integration this provider belongs to.',
        examples: ['int_2bCdEfGhJkLmNpQr']
      }),
      name: v.string({
        description: 'Display name.'
      }),
      description: v.nullable(
        v.string({
          description: 'Free-text description.'
        })
      ),
      metadata: v.nullable(
        v.record(v.any(), {
          description: 'Custom data you attach to identify or organize this record.'
        })
      ),
      tool_filter: v.nullable(toolFilterPresenter.schema),
      provider_id: v.string({
        description: 'Provider added to the integration.'
      }),
      deployment_id: v.string({
        description: 'Deployment the provider runs with.'
      }),
      auth_method_id: v.nullable(
        v.string({
          description: 'Auth method the provider runs with. `null` when none is set.'
        })
      ),
      auth_credentials_id: v.nullable(
        v.string({
          description: 'Credentials the provider runs with. `null` when none are set.'
        })
      ),
      config: v.nullable(v1ProviderConfigPreviewPresenter.schema),
      callbacks: v.object(integrationProviderCallbacks.properties, {
        name: 'callbacks',
        description: 'Provider callback state for this integration provider'
      }),
      created_at: v.date({
        description: 'Creation time.'
      }),
      updated_at: v.date({
        description: 'Last update time.'
      }),
      archived_at: v.nullable(
        v.date({
          description: 'When this was archived. `null` while active.'
        })
      )
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
      ...(await presentIntegrationProviderVersionRelations(
        integrationProvider,
        version,
        opts
      )),
      callbacks: {
        ...inner.callbacks,
        callback: await (async () => {
          let callback = activeCallback(integrationProvider);
          if (!callback) return null;

          return await dashboardCallbackPresenter.present({ callback }, opts).run();
        })()
      }
    };
  })
  .schema(
    v.object({
      ...v1IntegrationProviderPresenter.schema.properties,
      ...presentIntegrationProviderVersionRelations.properties,
      callbacks: v.object(
        {
          ...integrationProviderCallbacks.properties,
          callback: v.nullable(dashboardCallbackPresenter.schema)
        },
        {
          name: 'callbacks',
          description: 'Provider callback state for this integration provider'
        }
      )
    }) as any
  )
  .build();
