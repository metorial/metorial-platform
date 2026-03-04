import { Presenter } from '@lowerdeck/presenter';
import { v } from '@lowerdeck/validation';
import { providerTypeType } from '../../types';

export let v1ProviderTypePresenter = Presenter.create(providerTypeType)
  .presenter(async ({ providerType }) => ({
    object: 'provider.type' as const,
    id: providerType.id,
    name: providerType.name,
    config:
      providerType.config.status === 'enabled'
        ? {
            status: 'enabled' as const,
            read: {
              status: providerType.config.read.status
            }
          }
        : {
            status: 'disabled' as const
          },
    auth:
      providerType.auth.status === 'enabled'
        ? {
            status: 'enabled' as const,
            oauth:
              providerType.auth.oauth.status === 'enabled'
                ? {
                    status: 'enabled' as const,
                    oauth_callback_url: providerType.auth.oauth.oauthCallbackUrl ?? null,
                    oauth_auto_registration: providerType.auth.oauth.oauthAutoRegistration
                      ? {
                          status: providerType.auth.oauth.oauthAutoRegistration.status
                        }
                      : {
                          status: 'disabled' as const
                        }
                  }
                : {
                    status: 'disabled' as const
                  },
            export: {
              status: providerType.auth.export.status
            },
            import: {
              status: providerType.auth.import.status
            }
          }
        : {
            status: 'disabled' as const
          },
    created_at: providerType.createdAt
  }))
  .schema(
    v.object({
      object: v.literal('provider.type', {
        description: "String representing the object's type"
      }),
      id: v.string({
        name: 'id',
        description: 'Unique provider type identifier',
        examples: ['pty_3cDeFgHjKlMnPqRs']
      }),
      name: v.string({
        name: 'name',
        description: 'Display name of the provider type',
        examples: ['mcp']
      }),
      config: v.union(
        [
          v.object({
            status: v.literal('enabled'),
            read: v.object({
              status: v.enumOf(['enabled', 'disabled'], {
                name: 'status',
                description: 'Whether config reading is enabled'
              })
            })
          }),
          v.object({
            status: v.literal('disabled')
          })
        ],
        {
          name: 'config',
          description: 'Configuration capabilities for this provider type'
        }
      ),
      auth: v.union(
        [
          v.object({
            status: v.literal('enabled'),
            oauth: v.union(
              [
                v.object({
                  status: v.literal('enabled'),
                  oauth_callback_url: v.nullable(
                    v.string({
                      name: 'oauth_callback_url',
                      description: 'OAuth callback URL'
                    })
                  ),
                  oauth_auto_registration: v.object({
                    status: v.enumOf(['supported', 'unsupported'], {
                      name: 'status',
                      description: 'Whether OAuth auto-registration is supported'
                    })
                  })
                }),
                v.object({
                  status: v.literal('disabled')
                })
              ],
              {
                name: 'oauth',
                description: 'OAuth capabilities'
              }
            ),
            export: v.object({
              status: v.enumOf(['enabled', 'disabled'], {
                name: 'status',
                description: 'Whether auth export is enabled'
              })
            }),
            import: v.object({
              status: v.enumOf(['enabled', 'disabled'], {
                name: 'status',
                description: 'Whether auth import is enabled'
              })
            })
          }),
          v.object({
            status: v.literal('disabled')
          })
        ],
        {
          name: 'auth',
          description: 'Authentication capabilities for this provider type'
        }
      ),
      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when created',
        examples: [new Date('2025-09-15T10:30:00Z')]
      })
    })
  )
  .build();
