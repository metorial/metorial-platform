import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { protoGuardAlertType } from '../../types';
import { protoGuardIssueTypeValidator, protoGuardSeverityValidator } from './protoGuardShared';

let presentNullableId = (entity: { id: string } | null | undefined): string | null =>
  entity?.id ?? null;

let presentNullableNumber = (value: number | null | undefined): number | null => value ?? null;

let protoGuardAlertFilterSchema = v.object({
  object: v.literal('protoguard.alert_filter'),
  id: v.string(),
  filter_id: v.string(),
  key: v.string(),
  name: v.string(),
  description: v.nullable(v.string()),
  issue_type: protoGuardIssueTypeValidator,
  severity: protoGuardSeverityValidator,
  confidence: v.nullable(v.number()),
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
  created_at: v.date()
});

export let v1ProtoGuardAlertPresenter = Presenter.create(protoGuardAlertType)
  .presenter(async ({ alert }) => ({
    object: 'protoguard.alert' as const,
    id: alert.id,
    run_id: alert.run.id,
    session_id: presentNullableId(alert.session),
    session_message_id: presentNullableId(alert.message),
    session_connection_id: presentNullableId(alert.connection),
    provider_run_id: presentNullableId(alert.providerRun),
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
      object: v.literal('protoguard.alert'),
      id: v.string(),
      run_id: v.string(),
      session_id: v.nullable(v.string()),
      session_message_id: v.nullable(v.string()),
      session_connection_id: v.nullable(v.string()),
      provider_run_id: v.nullable(v.string()),
      filters: v.array(protoGuardAlertFilterSchema),
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
      created_at: v.date()
    })
  )
  .build();
