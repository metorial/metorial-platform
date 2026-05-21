import { v } from '@lowerdeck/validation';
import { getConfig } from '@metorial/config';
import { Presenter } from '@metorial/presenter';
import { providerSessionType } from '../../../types';
import { v1SessionProviderPresenter } from './sessionProvider';

export let v1SessionPresenter = Presenter.create(providerSessionType)
  .presenter(async ({ session }, opts) => ({
    object: 'session' as const,
    id: session.id,
    status: session.status,
    name: session.name,
    description: session.description,
    metadata: session.metadata,
    connection_state: session.connectionState,
    connection_url: `${getConfig().urls.apiUrl}/connect/mcp/${session.id}`,
    client_secret: session.clientSecret ?? null,
    usage: {
      total_productive_client_message_count: session.usage.totalProductiveClientMessageCount,
      total_productive_provider_message_count:
        session.usage.totalProductiveProviderMessageCount
    },
    providers: await Promise.all(
      session.providers
        .sort((a, b) => a.id.localeCompare(b.id))
        .map(p => v1SessionProviderPresenter.present({ sessionProvider: p }, opts).run())
    ),
    from_templates_ids: session.fromTemplatesIds,
    has_errors: session.hasErrors,
    has_warnings: session.hasWarnings,
    identity_actor_id: session.identityActorId ?? null,
    identity_id: session.identityId ?? null,
    created_at: session.createdAt,
    updated_at: session.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('session', { description: "String representing the object's type" }),
      id: v.string({
        name: 'id',
        description: 'Unique session identifier',
        examples: ['ses_4dEfGhJkLmNpQrSt']
      }),
      status: v.enumOf(['active', 'archived', 'deleted'], {
        name: 'status',
        description: 'Session status'
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
      metadata: v.nullable(
        v.record(v.any(), {
          name: 'metadata',
          description: 'Custom key-value pairs for storing additional information',
          examples: [{ imported_from: 'legacy-system', migration_date: '2025-09-01' }]
        })
      ),
      connection_state: v.enumOf(['connected', 'disconnected'], {
        name: 'connection_state',
        description: 'Session connection state'
      }),
      connection_url: v.string({
        name: 'connection_url',
        description: 'MCP connection URL for this session',
        examples: ['https://mcp.metorial.com/mcp/ses_4dEfGhJkLmNpQrSt']
      }),
      client_secret: v.nullable(
        v.string({
          name: 'client_secret',
          description: 'Session-scoped fine grained client secret token',
          examples: ['metorial_fk_4eC39HqLyjWDarjtT1zdp7dc']
        })
      ),
      usage: v.object({
        total_productive_client_message_count: v.number({
          name: 'total_productive_client_message_count',
          description: 'Total productive client messages'
        }),
        total_productive_provider_message_count: v.number({
          name: 'total_productive_provider_message_count',
          description: 'Total productive provider messages'
        })
      }),
      providers: v.array(v1SessionProviderPresenter.schema, {
        name: 'providers',
        description: 'Session providers'
      }),
      from_templates_ids: v.array(v.string(), {
        name: 'from_templates_ids',
        description: 'Template IDs this session was created from'
      }),
      has_errors: v.boolean({
        name: 'has_errors',
        description: 'Whether the session has any errors'
      }),
      has_warnings: v.boolean({
        name: 'has_warnings',
        description: 'Whether the session has any warnings'
      }),
      identity_actor_id: v.nullable(v.string()),
      identity_id: v.nullable(v.string()),
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
