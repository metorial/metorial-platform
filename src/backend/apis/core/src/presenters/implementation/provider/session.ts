import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { providerSessionType } from '../../types';

export let v1ProviderSessionPresenter = Presenter.create(providerSessionType)
  .presenter(async ({ session }) => {
    let usage = session.usage ?? {
      totalProductiveClientMessageCount: 0,
      totalProductiveServerMessageCount: 0
    };

    return {
      object: 'session' as const,
      id: session.id,
      name: session.name,
      description: session.description,
      status: session.status ?? 'active',
      connection_status: session.connectionState ?? 'disconnected',
      usage: {
        total_productive_message_count:
          (usage.totalProductiveClientMessageCount ?? 0) +
          (usage.totalProductiveServerMessageCount ?? 0),
        total_productive_client_message_count: usage.totalProductiveClientMessageCount ?? 0,
        total_productive_server_message_count: usage.totalProductiveServerMessageCount ?? 0
      },
      metadata: session.metadata,
      connection_url: session.connectionUrl ?? null,
      connection_key: session.connectionKey ?? null,
      provider_deployments: (session.providers ?? []).map(p => ({
        object: 'session.provider_deployment#preview' as const,
        id: p.id,
        name: p.deployment?.name ?? p.deployment?.provider?.name ?? null,
        provider_id: p.providerId,
        provider_deployment_id: p.deployment?.id ?? null
      })),
      created_at: session.createdAt,
      updated_at: session.updatedAt
    };
  })
  .schema(
    v.object({
      object: v.literal('session', { description: "String representing the object's type" }),
      id: v.string({
        name: 'id',
        description: 'Unique session identifier',
        examples: ['ses_4dEfGhJkLmNpQrSt']
      }),
      name: v.nullable(
        v.string({
          name: 'name',
          description: 'Display name',
          examples: ['Production Session']
        })
      ),
      description: v.nullable(
        v.string({
          name: 'description',
          description: 'Description',
          examples: ['Session for production environment']
        })
      ),
      status: v.enumOf(['active', 'deleted'], {
        name: 'status',
        description: 'Session status'
      }),
      connection_status: v.enumOf(['connected', 'disconnected'], {
        name: 'connection_status',
        description: 'Connection state'
      }),
      usage: v.object({
        total_productive_message_count: v.number({
          name: 'total_productive_message_count',
          description: 'Total productive messages'
        }),
        total_productive_client_message_count: v.number({
          name: 'total_productive_client_message_count',
          description: 'Total productive client messages'
        }),
        total_productive_server_message_count: v.number({
          name: 'total_productive_server_message_count',
          description: 'Total productive server messages'
        })
      }),
      metadata: v.nullable(
        v.record(v.any(), {
          name: 'metadata',
          description: 'Custom key-value pairs',
          examples: [{ environment: 'production' }]
        })
      ),
      connection_url: v.nullable(
        v.string({
          name: 'connection_url',
          description: 'MCP connection URL for this session',
          examples: [
            'https://mcp.metorial.com/mcp/ses_4dEfGhJkLmNpQrSt'
          ]
        })
      ),
      connection_key: v.nullable(
        v.string({
          name: 'connection_key',
          description: 'API key for authenticating MCP proxy connections to this session'
        })
      ),
      provider_deployments: v.array(
        v.object({
          object: v.literal('session.provider_deployment#preview', {
            description: "String representing the object's type"
          }),
          id: v.string({
            name: 'id',
            description: 'Session provider ID',
            examples: ['spr_3cDeFgHjKlMnPqRs']
          }),
          name: v.nullable(
            v.string({
              name: 'name',
              description: 'Display name',
              examples: ['GitHub Provider']
            })
          ),
          provider_id: v.string({
            name: 'provider_id',
            description: 'Provider ID',
            examples: ['pro_5gHjKlMnPqRsTuVw']
          }),
          provider_deployment_id: v.nullable(
            v.string({
              name: 'provider_deployment_id',
              description: 'Provider deployment ID',
              examples: ['pde_1aBcDeFgHjKlMnPq']
            })
          )
        }),
        {
          name: 'provider_deployments',
          description: 'List of provider deployments in this session'
        }
      ),
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
