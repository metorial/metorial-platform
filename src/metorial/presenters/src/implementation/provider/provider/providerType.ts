import { v } from '@lowerdeck/validation';
import { getOAuthCallbackUrl } from '@metorial-subspace/db';
import { Presenter } from '@metorial/presenter';
import { providerTypeType } from '../../../types';

export let v1ProviderTypePresenter = Presenter.create(providerTypeType)
  .presenter(async ({ providerType, provider, tenant }) => {
    let attributes = providerType.attributes;

    return {
      object: 'provider.type' as const,
      id: providerType.id,
      name: providerType.name,
      backend: attributes.backend,
      triggers:
        attributes.triggers.status == 'enabled'
          ? {
              status: 'enabled' as const,
              receiver_url: attributes.triggers.receiverUrl
            }
          : {
              status: 'disabled' as const
            },
      config:
        attributes.config.status === 'enabled'
          ? {
              status: 'enabled' as const,
              read: {
                status: attributes.config.read.status
              }
            }
          : {
              status: 'disabled' as const
            },
      auth:
        attributes.auth.status === 'enabled'
          ? {
              status: 'enabled' as const,
              oauth:
                attributes.auth.oauth.status === 'enabled'
                  ? {
                      status: 'enabled' as const,
                      oauth_callback_url: tenant
                        ? ((await getOAuthCallbackUrl(providerType, provider, tenant)) as
                            | string
                            | null)
                        : null,
                      oauth_auto_registration: attributes.auth.oauth.oauthAutoRegistration
                        ? {
                            status: attributes.auth.oauth.oauthAutoRegistration.status
                          }
                        : {
                            status: 'disabled' as const
                          }
                    }
                  : {
                      status: 'disabled' as const
                    },
              export: {
                status: attributes.auth.export.status
              },
              import: {
                status: attributes.auth.import.status
              }
            }
          : {
              status: 'disabled' as const
            },
      created_at: providerType.createdAt
    };
  })
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
      backend: v.enumOf(
        ['slates', 'native', 'mcp.container', 'mcp.function', 'mcp.remote'] as const,
        {
          name: 'backend',
          description: 'Backend type'
        }
      ),
      triggers: v.union(
        [
          v.object({
            status: v.literal('enabled'),
            receiver_url: v.string({
              name: 'receiver_url',
              description: 'The callback receiver URL for trigger-enabled providers',
              examples: ['https://triggers.metorial.com/receiver/provider-type']
            })
          }),
          v.object({
            status: v.literal('disabled')
          })
        ],
        {
          name: 'triggers',
          description: 'Trigger capabilities for this provider type'
        }
      ),
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
