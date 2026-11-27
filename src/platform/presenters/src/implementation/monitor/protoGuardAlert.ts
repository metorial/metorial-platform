import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { protoGuardAlertType } from '../../types';
import { protoGuardIssueTypeValidator, protoGuardSeverityValidator } from './protoGuardShared';

let presentNullableId = (entity: { id: string } | null | undefined): string | null =>
  entity?.id ?? null;

let presentNullableNumber = (value: number | null | undefined): number | null => value ?? null;

let protoGuardAlertFilterSchema = v.object(
  {
    object: v.literal('protoguard.alert_filter', {
      description: 'String representing the object’s type.'
    }),
    id: v.string({
      description: 'Unique ID.'
    }),
    filter_id: v.string({
      description: 'Filter that matched.'
    }),
    key: v.string({
      description: 'Stable key of the filter.'
    }),
    name: v.string({
      description: 'Display name.'
    }),
    description: v.nullable(
      v.string({
        description: 'Free-text description.'
      })
    ),
    issue_type: protoGuardIssueTypeValidator,
    severity: protoGuardSeverityValidator,
    confidence: v.nullable(
      v.number({
        description: 'Confidence of the match. `null` when not scored.'
      })
    ),
    rule_key: v.nullable(
      v.string({ name: 'rule_key', description: 'The rule within the filter that matched.' })
    ),
    direction: v.nullable(
      v.enumOf(['input', 'output', 'session'], {
        name: 'direction',
        description:
          'Whether the match was in the tool input, the tool output, or across the session.'
      })
    ),
    content_hash: v.nullable(
      v.string({
        name: 'content_hash',
        description:
          'A keyed hash of the matched text. Pass it to a suppression to silence this exact content.'
      })
    ),
    created_at: v.date({
      description: 'Creation time.'
    })
  },
  {
    description: 'One filter match folded into the alert.'
  }
);

export let v1ProtoGuardAlertPresenter = Presenter.create(protoGuardAlertType)
  .presenter(async ({ alert }) => ({
    object: 'protoguard.alert' as const,
    id: alert.id,
    run_id: alert.run.id,
    session_id: presentNullableId(alert.session),
    session_message_id: presentNullableId(alert.message),
    session_connection_id: presentNullableId(alert.connection),
    provider_run_id: presentNullableId(alert.providerRun),
    issue_id: presentNullableId(alert.issue),
    filters: alert.instances.map(instance => ({
      object: 'protoguard.alert_filter' as const,
      id: instance.id,
      filter_id: instance.filter.id,
      key: instance.filter.key,
      name: instance.filter.name,
      description: instance.filter.description,
      issue_type: instance.filter.issueType,
      severity: instance.filter.severity,
      confidence: presentNullableNumber(instance.confidence),
      rule_key: instance.ruleKey,
      direction: instance.direction,
      content_hash: instance.contentHmac,
      created_at: instance.createdAt
    })),
    occurrence_count: alert.occurrenceCount,
    first_seen_at: alert.firstSeenAt ?? alert.createdAt,
    last_seen_at: alert.lastSeenAt ?? alert.createdAt,
    created_at: alert.createdAt
  }))
  .schema(
    v.object({
      object: v.literal('protoguard.alert', {
        description: 'String representing the object’s type.'
      }),
      id: v.string({
        description: 'Unique ID.'
      }),
      run_id: v.string({
        description: 'Run that produced this alert.'
      }),
      session_id: v.nullable(
        v.string({
          description: 'Session the finding came from. `null` when the finding has no session.'
        })
      ),
      session_message_id: v.nullable(
        v.string({
          description: 'Message the finding came from. `null` when it spans the session.'
        })
      ),
      session_connection_id: v.nullable(
        v.string({
          description: 'Connection the finding came from. `null` when there is none.'
        })
      ),
      provider_run_id: v.nullable(
        v.string({
          description: 'Provider run the finding came from. `null` when there is none.'
        })
      ),
      issue_id: v.nullable(
        v.string({
          name: 'issue_id',
          description: 'Provider issue this alert is aggregated into.',
          examples: ['pis_9kLmNpQrStUvWxYz']
        })
      ),
      filters: v.array(protoGuardAlertFilterSchema, {
        description: 'Filter matches folded into this alert.'
      }),
      occurrence_count: v.number({
        name: 'occurrence_count',
        description: 'How many times the same finding recurred and was folded into this alert.'
      }),
      first_seen_at: v.date({
        name: 'first_seen_at',
        description: 'When the finding was first seen.'
      }),
      last_seen_at: v.date({
        name: 'last_seen_at',
        description: 'When the finding was last seen.'
      }),
      created_at: v.date({
        description: 'Creation time.'
      })
    })
  )
  .build();
