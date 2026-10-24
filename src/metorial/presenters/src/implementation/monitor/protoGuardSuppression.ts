import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { protoGuardSuppressionType } from '../../types';

export let v1ProtoGuardSuppressionPresenter = Presenter.create(protoGuardSuppressionType)
  .presenter(async ({ suppression }) => ({
    object: 'protoguard.suppression' as const,
    id: suppression.id,
    status: suppression.status,
    reason: suppression.reason,
    filter: {
      object: 'protoguard.filter#preview' as const,
      id: suppression.filter.id,
      key: suppression.filter.key,
      name: suppression.filter.name
    },
    provider_id: suppression.provider?.id ?? null,
    tool_key: suppression.toolKey,
    content_hash: suppression.contentHmac,
    expires_at: suppression.expiresAt,
    archived_at: suppression.archivedAt,
    created_at: suppression.createdAt,
    updated_at: suppression.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('protoguard.suppression'),
      id: v.string({ name: 'id', description: 'The unique identifier of the suppression.' }),
      status: v.enumOf(['active', 'archived'], {
        name: 'status',
        description: 'Whether the suppression currently hides matching findings.'
      }),
      reason: v.nullable(
        v.string({
          name: 'reason',
          description: 'Why the findings are considered benign.',
          examples: ['The tool documentation quotes injection examples on purpose.']
        })
      ),
      filter: v.object({
        object: v.literal('protoguard.filter#preview'),
        id: v.string({ name: 'id', description: 'The unique identifier of the filter.' }),
        key: v.string({
          name: 'key',
          description: 'The stable key of the filter.',
          examples: ['instruction_override']
        }),
        name: v.string({ name: 'name', description: 'The display name of the filter.' })
      }),
      provider_id: v.nullable(
        v.string({
          name: 'provider_id',
          description:
            'The provider whose findings are suppressed, or null to suppress across all providers.'
        })
      ),
      tool_key: v.nullable(
        v.string({
          name: 'tool_key',
          description:
            'The tool whose findings are suppressed, or null to suppress across all tools.'
        })
      ),
      content_hash: v.nullable(
        v.string({
          name: 'content_hash',
          description:
            'The keyed content hash of a specific matched text, taken from a ProtoGuard finding, or null to suppress any content.'
        })
      ),
      expires_at: v.nullable(
        v.date({
          name: 'expires_at',
          description: 'When the suppression stops applying, or null if it never expires.'
        })
      ),
      archived_at: v.nullable(
        v.date({ name: 'archived_at', description: 'When the suppression was archived.' })
      ),
      created_at: v.date({
        name: 'created_at',
        description: 'When the suppression was created.'
      }),
      updated_at: v.date({
        name: 'updated_at',
        description: 'When the suppression was last updated.'
      })
    })
  )
  .build();
