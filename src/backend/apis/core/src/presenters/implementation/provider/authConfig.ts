import { Presenter } from '@lowerdeck/presenter';
import { v } from '@lowerdeck/validation';
import { providerAuthConfigType } from '../../types';
import { v1ProviderAuthCredentialsPresenter } from './authCredentials';
import { v1ProviderAuthMethodPresenter } from './authMethod';
import { v1ProviderDeploymentPreviewPresenter } from './deploymentPreview';

export let v1ProviderAuthConfigPresenter = Presenter.create(providerAuthConfigType)
  .presenter(async ({ authConfig }, opts) => ({
    object: 'provider.auth_config' as const,

    id: authConfig.id,
    type: authConfig.type,
    source: authConfig.source,
    status: authConfig.status,

    is_default: authConfig.isDefault,

    provider_id: authConfig.providerId,

    name: authConfig.name,
    description: authConfig.description,
    metadata: authConfig.metadata,

    deployment_preview: authConfig.deploymentPreview
      ? await v1ProviderDeploymentPreviewPresenter
          .present({ deployment: authConfig.deploymentPreview }, opts)
          .run()
      : null,

    credentials: authConfig.credentials
      ? await v1ProviderAuthCredentialsPresenter
          .present({ authCredentials: authConfig.credentials }, opts)
          .run()
      : null,

    auth_method: await v1ProviderAuthMethodPresenter
      .present({ authMethod: authConfig.authMethod }, opts)
      .run(),

    created_at: authConfig.createdAt,
    updated_at: authConfig.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('provider.auth_config', {
        description: "String representing the object's type"
      }),
      id: v.string({
        name: 'id',
        description: 'Unique auth config identifier',
        examples: ['pac_8pQrStUvWxYzAbCd']
      }),
      type: v.enumOf(['manual', 'oauth_automated', 'oauth_manual'], {
        name: 'type',
        description: 'Authentication type'
      }),
      source: v.enumOf(['manual', 'setup_session', 'system'], {
        name: 'source',
        description: 'Auth config source'
      }),
      status: v.enumOf(['active', 'archived'], {
        name: 'status',
        description: 'Auth config status'
      }),
      is_default: v.boolean({
        name: 'is_default',
        description: 'Whether this is the default auth config'
      }),
      provider_id: v.string({
        name: 'provider_id',
        description: 'Provider ID',
        examples: ['pro_5gHjKlMnPqRsTuVw']
      }),
      name: v.nullable(
        v.string({
          name: 'name',
          description: 'Display name',
          examples: ['GitHub OAuth Token']
        })
      ),
      description: v.nullable(
        v.string({
          name: 'description',
          description: 'Description',
          examples: ['OAuth token for GitHub API access']
        })
      ),
      metadata: v.nullable(
        v.record(v.any(), {
          name: 'metadata',
          description: 'Custom key-value pairs for storing additional information',
          examples: [{ connected_by: 'alex@company.com', purpose: 'ci-pipeline' }]
        })
      ),
      deployment_preview: v.nullable(v1ProviderDeploymentPreviewPresenter.schema),
      credentials: v.nullable(v1ProviderAuthCredentialsPresenter.schema),
      auth_method: v1ProviderAuthMethodPresenter.schema,
      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when created',
        examples: [new Date('2025-09-15T10:30:00Z')]
      }),
      updated_at: v.date({
        name: 'updated_at',
        description: 'Timestamp when last updated',
        examples: [new Date('2026-01-10T14:45:00Z')]
      })
    })
  )
  .build();
