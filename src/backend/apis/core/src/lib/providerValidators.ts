import { v } from '@lowerdeck/validation';

export let deploymentValidator = v.union([
  v.object({
    provider_deployment_id: v.optional(
      v.string({
        description: 'Existing provider deployment ID',
        examples: ['pdp_4dEfGhJkLmNpQrSt']
      })
    )
  }),
  v.object({
    provider_deployment: v.optional(
      v.object({
        provider_id: v.string({
          description: 'Provider ID',
          examples: ['pro_5gHjKlMnPqRsTuVw']
        }),
        name: v.optional(v.string({ examples: ['Default Deployment'] })),
        description: v.optional(
          v.string({ examples: ['Deployment for production environment'] })
        ),
        metadata: v.optional(
          v.record(v.any(), {
            description: 'Custom key-value pairs for storing additional information',
            examples: [{ env: 'production', team: 'backend' }]
          })
        ),
        locked_provider_version_id: v.optional(
          v.string({
            description: 'Locked provider version ID to ensure consistent behavior',
            examples: ['pv_1a2b3c4d5e6f7g8h9']
          })
        )
      })
    )
  })
]);

export let configValidator = v.union([
  v.object({
    provider_config_id: v.optional(
      v.string({
        description: 'Existing provider config ID',
        examples: ['pcf_7dEfGhJkLmNpQrSt']
      })
    )
  }),
  v.object({
    provider_config: v.optional(
      v.union([
        v.object({
          name: v.optional(v.string({ examples: ['Default Config'] })),
          value: v.record(v.any(), {
            description: 'Provider-specific configuration values',
            examples: [{ api_key: 'sk-xxx', base_url: 'https://api.example.com' }]
          })
        }),
        v.object({
          name: v.optional(v.string({ examples: ['Default Config'] })),
          provider_config_vault_id: v.string({
            description: 'Provider config vault ID',
            examples: ['pcvt_3bCdEfGhJkLmNpQr']
          }),
          provider_id: v.optional(
            v.string({
              description: 'Explicitly specify provider ID to associate with this auth config',
              examples: ['pro_5gHjKlMnPqRsTuVw']
            })
          )
        })
      ])
    )
  })
]);

export let authConfigValidator = v.union([
  v.object({
    provider_auth_config_id: v.optional(
      v.string({
        description: 'Existing provider auth config ID',
        examples: ['pac_3nOpRsTuVwXyZaBc']
      })
    )
  }),
  v.object({
    provider_auth_config: v.optional(
      v.object({
        name: v.optional(v.string({ examples: ['Default Auth Config'] })),
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
  })
]);
