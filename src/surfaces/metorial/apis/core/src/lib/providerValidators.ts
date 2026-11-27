import { v } from '@lowerdeck/validation';

// One object with optional alternatives, not a union of objects: objects drop unknown keys and a
// union returns its first match, so a union of all-optional objects discards the other alternatives.
export let deploymentValidator = v.object({
  provider_deployment_id: v.optional(
    v.string({
      description: 'ID of an existing deployment to use.',
      examples: ['pdp_4dEfGhJkLmNpQrSt']
    })
  ),
  provider_deployment: v.optional(
    v.object({
      provider_id: v.string({
        description: 'Provider to create the deployment for.',
        examples: ['pro_5gHjKlMnPqRsTuVw']
      }),
      name: v.optional(v.string({ examples: ['Default Deployment'] }), {
        description: 'Display name.'
      }),
      description: v.optional(
        v.string({ examples: ['Deployment for production environment'] }),
        { description: 'Free-text description.' }
      ),
      metadata: v.optional(
        v.record(v.any(), {
          description: 'Custom data to identify or organize the deployment.',
          examples: [{ env: 'production', team: 'backend' }]
        })
      ),
      locked_provider_version_id: v.optional(
        v.string({
          description: 'Version to lock the deployment to. Omit to follow the current version.',
          examples: ['pv_1a2b3c4d5e6f7g8h9']
        })
      )
    })
  )
});

export let configValidator = v.object({
  provider_config_id: v.optional(
    v.string({
      description: 'ID of an existing config to use.',
      examples: ['pcf_7dEfGhJkLmNpQrSt']
    })
  ),
  provider_config: v.optional(
    v.union([
      v.object({
        name: v.optional(v.string({ examples: ['Default Config'] }), {
          description: 'Display name.'
        }),
        value: v.record(v.any(), {
          description: 'Provider-specific configuration values',
          examples: [{ api_key: 'sk-xxx', base_url: 'https://api.example.com' }]
        })
      }),
      v.object({
        name: v.optional(v.string({ examples: ['Default Config'] }), {
          description: 'Display name.'
        }),
        provider_config_vault_id: v.string({
          description: 'Vault to take the values from.',
          examples: ['pcvt_3bCdEfGhJkLmNpQr']
        }),
        provider_id: v.optional(
          v.string({
            description: 'Explicitly specify provider ID to associate with this config',
            examples: ['pro_5gHjKlMnPqRsTuVw']
          })
        )
      })
    ])
  )
});

export let authConfigValidator = v.object({
  provider_auth_config_id: v.optional(
    v.string({
      description: 'ID of an existing auth config to use.',
      examples: ['pac_3nOpRsTuVwXyZaBc']
    })
  ),
  provider_auth_config: v.optional(
    v.object({
      name: v.optional(v.string({ examples: ['Default Auth Config'] }), {
        description: 'Display name.'
      }),
      provider_auth_method_id: v.string({
        description: 'The authentication method to use (e.g., OAuth flow)',
        examples: ['pam_2mNpQrStUvWxYzAb']
      }),
      credentials: v.record(v.any(), {
        description: 'Provider-specific authentication credentials',
        examples: [{ client_id: 'abc123', client_secret: 'def456' }]
      }),
      provider_id: v.optional(
        v.string({
          description: 'Explicitly specify provider ID to associate with this auth config',
          examples: ['pro_5gHjKlMnPqRsTuVw']
        })
      )
    })
  )
});
