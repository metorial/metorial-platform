import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { protoGuardAlertType } from '../../types';
import { protoGuardIssueTypeValidator, protoGuardSeverityValidator } from './protoGuardShared';

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
    run_id: alert.runId,
    session_id: alert.sessionId,
    session_message_id: alert.sessionMessageId,
    session_connection_id: alert.sessionConnectionId,
    provider_run_id: alert.providerRunId,
    filters: alert.filters.map((filter: (typeof alert.filters)[number]) => ({
      object: 'protoguard.alert_filter' as const,
      id: filter.id,
      filter_id: filter.filterId,
      key: filter.key,
      name: filter.name,
      description: filter.description,
      issue_type: filter.issueType,
      severity: filter.severity,
      confidence: filter.confidence,
      created_at: filter.createdAt
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
