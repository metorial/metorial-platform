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
      created_at: instance.createdAt
    })),
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
      created_at: v.date()
    })
  )
  .build();
