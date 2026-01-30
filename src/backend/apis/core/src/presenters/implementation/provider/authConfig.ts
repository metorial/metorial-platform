import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { authConfigType } from '../../types';

export let v1AuthConfigPresenter = Presenter.create(authConfigType)
  .presenter(async ({ authConfig }) => ({
    object: 'provider.auth_config' as const,
    id: authConfig.id,
    type: authConfig.type ?? 'manual',
    name: authConfig.name,
    description: authConfig.description,
    metadata: authConfig.metadata,
    provider_id: authConfig.providerId,
    provider_deployment_id: authConfig.providerDeploymentId ?? authConfig.deploymentId,
    provider_auth_method_id: authConfig.providerAuthMethodId ?? authConfig.authMethodId,
    created_at: authConfig.createdAt,
    updated_at: authConfig.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('provider.auth_config', { description: "String representing the object's type" }),
      id: v.string({ name: 'id', description: 'Unique auth config identifier', examples: ['pac_8pQrStUvWxYzAbCd'] }),
      type: v.enumOf(['manual', 'oauth_automated', 'oauth_manual'], { name: 'type', description: 'Authentication type' }),
      name: v.nullable(v.string({ name: 'name', description: 'Display name', examples: ['GitHub OAuth Token'] })),
      description: v.nullable(v.string({ name: 'description', description: 'Description', examples: ['OAuth token for GitHub API access'] })),
      metadata: v.nullable(v.record(v.any(), { name: 'metadata', description: 'Custom key-value pairs for storing additional information', examples: [{ connected_by: 'alex@company.com', purpose: 'ci-pipeline' }] })),
      provider_id: v.string({ name: 'provider_id', description: 'Provider ID', examples: ['pro_5gHjKlMnPqRsTuVw'] }),
      provider_deployment_id: v.nullable(
        v.string({ name: 'provider_deployment_id', description: 'Deployment ID', examples: ['pde_1aBcDeFgHjKlMnPq'] })
      ),
      provider_auth_method_id: v.string({
        name: 'provider_auth_method_id',
        description: 'Auth method ID',
        examples: ['pam_2mNpQrStUvWxYzAb']
      }),
      created_at: v.date({ name: 'created_at', description: 'Timestamp when created', examples: [new Date('2025-09-15T10:30:00Z')] }),
      updated_at: v.date({ name: 'updated_at', description: 'Timestamp when last updated', examples: [new Date('2026-01-10T14:45:00Z')] })
    })
  )
  .build();
