import { v } from '@lowerdeck/validation';
import { getConfig } from '@metorial/config';
import { Presenter } from '@metorial/presenter';
import { presentOwnerActor, presentResourceSource, resourceAccessSchema } from '../../_shared';
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
    connection_url: `${getConfig().urls.connectUrl}/connect/mcp/${session.id}`,
    client_secret: session.clientSecret ?? null,
    usage: {
      total_productive_client_message_count: session.totalProductiveClientMessageCount,
      total_productive_provider_message_count: session.totalProductiveProviderMessageCount
    },
    providers: await Promise.all(
      session.providers
        .sort((a, b) => a.id.localeCompare(b.id))
        .map(p => v1SessionProviderPresenter.present({ sessionProvider: p }, opts).run())
    ),
    from_template_ids: [
      ...new Set(
        session.providers.flatMap(provider =>
          provider.fromTemplate ? [provider.fromTemplate.id] : []
        )
      )
    ],
    has_errors: session.hasErrors,
    has_warnings: session.hasWarnings,
    identity_actor_id: session.identityActor?.id ?? null,
    access: {
      source: presentResourceSource(session.source),
      type: session.isOwnerLocked ? ('owner_locked' as const) : ('public' as const),
      visibility: session.isOwnerOnlyVisible ? ('owner' as const) : ('anyone' as const),
      owner: presentOwnerActor(session.ownerActor ?? session.identityActor)
    },
    identity_id: session.identity?.id ?? null,
    created_at: session.createdAt,
    updated_at: session.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('session', { description: "String representing the object’s type." }),
      id: v.string({
        name: 'id',
        description: 'Unique ID.',
        examples: ['ses_4dEfGhJkLmNpQrSt']
      }),
      status: v.enumOf(['active', 'archived', 'deleted'], {
        name: 'status',
        description: '`archived` once the session is deleted. Archived sessions stay listable.'
      }),
      name: v.nullable(
        v.string({
          name: 'name',
          description: 'Display name.',
          examples: ['Production Session']
        })
      ),
      description: v.nullable(
        v.string({
          name: 'description',
          description: 'Free-text description.',
          examples: ['Session for production environment']
        })
      ),
      metadata: v.nullable(
        v.record(v.any(), {
          name: 'metadata',
          description: 'Custom data you attach to identify or organize this record.',
          examples: [{ imported_from: 'legacy-system', migration_date: '2025-09-01' }]
        })
      ),
      connection_state: v.enumOf(['connected', 'disconnected'], {
        name: 'connection_state',
        description: 'Whether the session currently holds an open connection.'
      }),
      connection_url: v.string({
        name: 'connection_url',
        description: 'MCP connection URL for this session.',
        examples: ['https://mcp.metorial.com/mcp/ses_4dEfGhJkLmNpQrSt']
      }),
      client_secret: v.nullable(
        v.string({
          name: 'client_secret',
          description: 'Secret for scoped client access. `null` when the caller cannot use this session.',
          examples: ['metorial_fk_4eC39HqLyjWDarjtT1zdp7dc']
        })
      ),
      usage: v.object(
        {
          total_productive_client_message_count: v.number({
            name: 'total_productive_client_message_count',
            description: 'Total productive client messages'
          }),
          total_productive_provider_message_count: v.number({
            name: 'total_productive_provider_message_count',
            description: 'Total productive provider messages'
          })
        },
        { name: 'usage', description: 'Usage statistics.' }
      ),
      providers: v.array(v1SessionProviderPresenter.schema, {
        name: 'providers',
        description: 'Providers connected to this session.'
      }),
      from_template_ids: v.array(v.string(), {
        name: 'from_template_ids',
        description: 'Templates the session was created from. Empty when created without one.'
      }),
      has_errors: v.boolean({
        name: 'has_errors',
        description: '`true` when the session has errors.'
      }),
      has_warnings: v.boolean({
        name: 'has_warnings',
        description: '`true` when the session has warnings.'
      }),
      identity_actor_id: v.nullable(
        v.string({
          description: 'Identity actor connected to the session. `null` when there is none.'
        })
      ),
      access: resourceAccessSchema,
      identity_id: v.nullable(
        v.string({
          description: 'Identity connected to the session. `null` when there is none.'
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
      })
    })
  )
  .build();
