import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { presentOwnerActor, presentResourceSource, resourceAccessSchema } from '../../_shared';
import { getProviderSetupSessionUrl } from '@metorial-subspace/module-auth/src/lib/setupSessionUrl';
import { providerSetupSessionType } from '../../../types';
import {
  presentRawProviderAuthMethod,
  presentRawProviderConfig,
  presentRawProviderDeploymentPreview
} from '../auth/_raw';
import { v1ProviderAuthConfigPresenter } from '../auth/authConfig';
import { v1ProviderAuthCredentialsPresenter } from '../auth/authCredentials';
import { v1ProviderAuthMethodPresenter } from '../auth/authMethod';
import { v1ConfigPresenter } from '../config/config';
import { v1ProviderDeploymentPreviewPresenter } from '../config/deploymentPreview';

export let v1SetupSessionPresenter = Presenter.create(providerSetupSessionType)
  .presenter(async ({ setupSession }, opts) => {
    let configuration = (setupSession as { configuration?: any }).configuration;
    let status =
      setupSession.status === 'pending' && setupSession.expiresAt <= new Date()
        ? ('expired' as const)
        : setupSession.status;

    let oauthErrorMessage =
      setupSession.oauthSetup?.errorMessage || setupSession.oauthSetup?.errorCode;

    return {
      object: 'provider.setup_session' as const,

      id: setupSession.id,
      type: setupSession.typeSelected,
      status,

      url: getProviderSetupSessionUrl(setupSession),

      error: oauthErrorMessage
        ? {
            code: setupSession.oauthSetup?.errorCode || 'oauth_error',
            message: oauthErrorMessage
          }
        : null,

      name: setupSession.name,
      description: setupSession.description,
      metadata: setupSession.metadata,

      configuration: configuration
        ? {
            provider_search: configuration.providerSearch
              ? {
                  groups: configuration.providerSearch.groups?.map(
                    (group: { groupId: string }) => ({
                      group_id: group.groupId
                    })
                  ),
                  collections: configuration.providerSearch.collections?.map(
                    (collection: { collectionId: string }) => ({
                      collection_id: collection.collectionId
                    })
                  ),
                  categories: configuration.providerSearch.categories?.map(
                    (category: { categoryId: string }) => ({
                      category_id: category.categoryId
                    })
                  )
                }
              : undefined,

            tool_filters: configuration.toolFilters
              ? {
                  enabled: configuration.toolFilters.enabled
                }
              : undefined,

            ui: configuration.ui
              ? {
                  layout: configuration.ui.layout
                }
              : undefined
          }
        : null,

      provider_id: setupSession.provider?.id ?? null,
      identity_id: setupSession.identity?.id ?? null,
      identity_credential_id: setupSession.identityCredential?.id ?? null,
      access: {
        source: presentResourceSource(setupSession.source),
        type: setupSession.isOwnerLocked ? ('owner_locked' as const) : ('public' as const),
        visibility: setupSession.isOwnerOnlyVisible ? ('owner' as const) : ('anyone' as const),
        owner: presentOwnerActor(setupSession.ownerActor)
      },

      auth_method:
        setupSession.provider && setupSession.authMethod
          ? await v1ProviderAuthMethodPresenter
              .present(
                {
                  authMethod: presentRawProviderAuthMethod(
                    setupSession.authMethod,
                    setupSession.provider
                  )
                },
                opts
              )
              .run()
          : null,

      deployment:
        setupSession.provider && setupSession.deployment
          ? await v1ProviderDeploymentPreviewPresenter
              .present(
                {
                  deployment: presentRawProviderDeploymentPreview(
                    setupSession.deployment,
                    setupSession.provider
                  )
                },
                opts
              )
              .run()
          : null,

      credentials:
        setupSession.provider && setupSession.authCredentials
          ? await v1ProviderAuthCredentialsPresenter
              .present(
                {
                  authCredentials: {
                    ...setupSession.authCredentials,
                    provider: setupSession.provider
                  }
                },
                opts
              )
              .run()
          : null,

      auth_config:
        setupSession.provider && setupSession.authConfig
          ? await v1ProviderAuthConfigPresenter
              .present(
                {
                  authConfig: {
                    ...setupSession.authConfig,
                    provider: setupSession.provider
                  }
                },
                opts
              )
              .run()
          : null,

      config:
        setupSession.provider && setupSession.config
          ? await v1ConfigPresenter
              .present(
                {
                  config: presentRawProviderConfig(setupSession.config, setupSession.provider)
                },
                opts
              )
              .run()
          : null,

      ui_mode: setupSession.uiMode,
      redirect_url: setupSession.redirectUrl,

      created_at: setupSession.createdAt,
      updated_at: setupSession.updatedAt,
      expires_at: setupSession.expiresAt
    };
  })
  .schema(
    v.object({
      object: v.literal('provider.setup_session', {
        description: 'String representing the object’s type.'
      }),
      id: v.string({
        name: 'id',
        description: 'Unique ID.',
        examples: ['pas_6eFgHjKlMnPqRsTu']
      }),
      type: v.enumOf(['auth_only', 'config_only', 'auth_and_config', 'admin'], {
        name: 'type',
        description:
          'Setup session type. `admin` sessions produce an admin consent link and complete without creating credentials.'
      }),
      status: v.enumOf(['failed', 'archived', 'deleted', 'pending', 'completed', 'expired'], {
        name: 'status',
        description:
          'Session status. `pending` until the flow completes. Reads as `expired` once past `expires_at`. `archived` once the session is archived.'
      }),
      url: v.string({
        name: 'url',
        description: 'URL where the user completes this session.',
        examples: ['https://provider.metorial.com/setup/pas_6eFgHjKlMnPqRsTu']
      }),
      error: v.nullable(
        v.object(
          {
            code: v.string({
              name: 'code',
              description:
                'Machine-readable error code reported by the OAuth provider or integration',
              examples: ['consent_required']
            }),
            message: v.string({
              name: 'message',
              description: 'Human-readable error message',
              examples: ['consent_required: AADSTS90094: Admin consent is required.']
            })
          },
          {
            name: 'error',
            description:
              'The error reported during the OAuth step of this session, or null if none occurred'
          }
        )
      ),
      name: v.nullable(
        v.string({
          name: 'name',
          description: 'Display name.',
          examples: ['GitHub OAuth Setup']
        })
      ),
      description: v.nullable(
        v.string({
          name: 'description',
          description: 'Free-text description.',
          examples: ['Connect your GitHub account']
        })
      ),
      metadata: v.nullable(
        v.record(v.any(), {
          name: 'metadata',
          description: 'Custom data you attach to identify or organize this record.',
          examples: [{ redirect_uri: 'https://app.example.com/callback' }]
        })
      ),
      configuration: v.nullable(
        v.record(v.any(), {
          name: 'configuration',
          description:
            'Options shaping the session flow, like provider search filters and UI layout.'
        })
      ),
      provider_id: v.nullable(
        v.string({
          name: 'provider_id',
          description: 'Provider the session sets up, or `null` when none was chosen.',
          examples: ['pro_5gHjKlMnPqRsTuVw']
        })
      ),
      identity_id: v.nullable(
        v.string({
          name: 'identity_id',
          description: 'Identity the session is linked to. `null` when unlinked.',
          examples: ['idn_3nOpRsTuVwXyZaBc']
        })
      ),
      identity_credential_id: v.nullable(
        v.string({
          name: 'identity_credential_id',
          description: 'Identity credential created from this setup session',
          examples: ['idc_3nOpRsTuVwXyZaBc']
        })
      ),
      access: resourceAccessSchema,
      auth_method: v.nullable(v1ProviderAuthMethodPresenter.schema),
      deployment: v.nullable(v1ProviderDeploymentPreviewPresenter.schema),
      credentials: v.nullable(v1ProviderAuthCredentialsPresenter.schema),
      auth_config: v.nullable(v1ProviderAuthConfigPresenter.schema),
      config: v.nullable(v1ConfigPresenter.schema),
      ui_mode: v.enumOf(['metorial_elements', 'dashboard_embeddable'] as const, {
        name: 'ui_mode',
        description: 'How the session UI is presented.'
      }),
      redirect_url: v.nullable(
        v.string({
          name: 'redirect_url',
          description: 'URL to redirect after setup',
          examples: ['https://app.example.com/callback']
        })
      ),
      created_at: v.date({
        name: 'created_at',
        description: 'Creation time.',
        examples: [new Date('2025-09-15T10:30:00Z')]
      }),
      updated_at: v.date({
        name: 'updated_at',
        description: 'Last update time.',
        examples: [new Date('2026-01-10T14:45:00Z')]
      }),
      expires_at: v.date({
        name: 'expires_at',
        description:
          'When the session expires. `pending` sessions read as `expired` past this time.',
        examples: [new Date('2025-09-15T11:30:00Z')]
      })
    }) as any
  )
  .build();

export let dashboardSetupSessionPresenter = Presenter.create(providerSetupSessionType)
  .presenter(async ({ setupSession }, opts) => {
    let inner = await v1SetupSessionPresenter.present({ setupSession }, opts).run({});

    return {
      ...inner,

      public_mcp_server_id: setupSession.ownerPublicMcpServer?.id ?? null
    };
  })
  .schema(
    v.intersection([
      v1SetupSessionPresenter.schema,
      v.object({
        public_mcp_server_id: v.nullable(
          v.string({
            name: 'public_mcp_server_id',
            description:
              "ID of the public MCP server this resource belongs to. Such resources hold an end user's credentials and are read-only.",
            examples: ['pmsv_1aBcDeFgHjKlMnPq']
          })
        )
      })
    ])
  )
  .build();
