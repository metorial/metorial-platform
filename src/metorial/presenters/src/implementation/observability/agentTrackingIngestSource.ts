import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { agentTrackingIngestSourceType } from '../../types';

export let v1AgentTrackingIngestSourcePresenter = Presenter.create(
  agentTrackingIngestSourceType
)
  .presenter(async ({ ingestSource, ingestUrl, lastUsedAt, lastUsedStatus, secret }) => ({
    object: 'agent_tracking.ingest_source' as const,

    id: ingestSource.id,
    status: ingestSource.status,
    name: ingestSource.name,
    client_family: ingestSource.clientFamily,

    secret_redacted: ingestSource.secretRedacted,
    secret,
    ingest_url: ingestUrl,

    last_used_at: lastUsedAt,
    last_used_status: lastUsedStatus,
    revoked_at: ingestSource.revokedAt,
    created_at: ingestSource.createdAt,
    updated_at: ingestSource.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('agent_tracking.ingest_source', {
        description: "String representing the object's type"
      }),

      id: v.string({
        name: 'id',
        description: 'The unique identifier of the ingestion key.',
        examples: ['atis_0mhNnEqM7XQb3vXq8gD2']
      }),
      status: v.enumOf(['active', 'revoked'], {
        name: 'status',
        description: 'Whether the key is accepted. A revoked key stays revoked.'
      }),
      name: v.string({
        name: 'name',
        description: 'The name of the ingestion key.',
        examples: ['Engineering laptops']
      }),
      client_family: v.string({
        name: 'client_family',
        description: 'The AI coding agent the key is set up for.',
        examples: ['claude_code']
      }),

      secret_redacted: v.string({
        name: 'secret_redacted',
        description: 'The start and end of the key, for recognizing it. Not usable as a key.',
        examples: ['metorial_agis_4eC3...p7dc']
      }),
      secret: v.nullable(
        v.string({
          name: 'secret',
          description:
            'The key itself. Returned only when the key is created; null on every other response.'
        })
      ),
      ingest_url: v.nullable(
        v.string({
          name: 'ingest_url',
          description:
            'The base URL the agent sends usage to with this key, or null while ingestion is not configured.',
          examples: ['https://agent-tracking-ingest-us1.metorial.com']
        })
      ),

      last_used_at: v.nullable(
        v.date({
          name: 'last_used_at',
          description:
            'When data last arrived with this key. Null when none has arrived or when it cannot be determined right now; last_used_status tells the two apart.'
        })
      ),
      last_used_status: v.enumOf(['used', 'never_used', 'unknown'], {
        name: 'last_used_status',
        description:
          'used when data has arrived with this key (last_used_at says when); never_used when none has; unknown when agent tracking could not be asked right now, so last_used_at is null without meaning never.'
      }),
      revoked_at: v.nullable(
        v.date({
          name: 'revoked_at',
          description: 'When the key was revoked, or null while it is active.'
        })
      ),
      created_at: v.date({ name: 'created_at', description: 'When the key was created.' }),
      updated_at: v.date({ name: 'updated_at', description: 'When the key was last changed.' })
    })
  )
  .build();
