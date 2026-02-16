import { v } from '@metorial/validation';

export let configSourceValidator = v.union([
  v.object({ type: v.literal('none') }, { name: 'none', description: 'No configuration' }),
  v.object(
    { type: v.literal('reference'), provider_config_id: v.string() },
    { name: 'reference', description: 'Reference an existing provider config' }
  ),
  v.object(
    {
      type: v.literal('new'),
      name: v.optional(v.string()),
      config: v.union([
        v.object(
          { type: v.literal('new'), data: v.record(v.any()) },
          { name: 'new', description: 'Provide configuration data directly' }
        ),
        v.object(
          { type: v.literal('vault'), provider_config_vault_id: v.string() },
          { name: 'vault', description: 'Use a config vault template' }
        )
      ])
    },
    { name: 'new', description: 'Create a new ephemeral provider config' }
  )
]);

export let deploymentValidator = v.union([
  v.object(
    { type: v.literal('reference'), provider_deployment_id: v.string() },
    { name: 'reference', description: 'Reference an existing provider deployment' }
  ),
  v.object(
    {
      type: v.literal('new'),
      provider_id: v.string(),
      name: v.optional(v.string()),
      description: v.optional(v.string()),
      metadata: v.optional(v.record(v.any())),
      locked_provider_version_id: v.optional(v.string()),
      config: v.optional(configSourceValidator)
    },
    { name: 'new', description: 'Create a new ephemeral provider deployment' }
  ),
  v.string({ description: 'Shorthand: deployment ID' })
]);

export let configValidator = v.union([
  v.object(
    { type: v.literal('reference'), provider_config_id: v.string() },
    { name: 'reference', description: 'Reference an existing provider config' }
  ),
  v.object(
    {
      type: v.literal('new'),
      name: v.optional(v.string()),
      config: v.union([
        v.object(
          { type: v.literal('new'), data: v.record(v.any()) },
          { name: 'new', description: 'Provide configuration data directly' }
        ),
        v.object(
          { type: v.literal('vault'), provider_config_vault_id: v.string() },
          { name: 'vault', description: 'Use a config vault template' }
        )
      ])
    },
    { name: 'new', description: 'Create a new ephemeral provider config' }
  ),
  v.string({ description: 'Shorthand: config ID' })
]);

export let authConfigValidator = v.union([
  v.object(
    { type: v.literal('reference'), provider_auth_config_id: v.string() },
    { name: 'reference', description: 'Reference an existing provider auth config' }
  ),
  v.object(
    {
      type: v.literal('new'),
      name: v.optional(v.string()),
      provider_auth_method_id: v.string(),
      credentials: v.record(v.any())
    },
    { name: 'new', description: 'Create a new ephemeral provider auth config' }
  ),
  v.string({ description: 'Shorthand: auth config ID' })
]);
