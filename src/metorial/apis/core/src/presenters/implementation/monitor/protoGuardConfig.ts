import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { protoGuardConfigType } from '../../types';
import { protoGuardIssueTypeValidator, protoGuardSeverityValidator } from './protoGuardShared';

let protoGuardFilterSchema = v.object({
  object: v.literal('protoguard.filter'),
  id: v.string(),
  key: v.string(),
  name: v.string(),
  description: v.nullable(v.string()),
  issue_type: protoGuardIssueTypeValidator,
  severity: protoGuardSeverityValidator,
  score_weight: v.number(),
  default_enabled: v.boolean(),
  enabled: v.boolean(),
  default_alert_confidence_threshold: v.number(),
  alert_confidence_threshold: v.number()
});

export let v1ProtoGuardConfigPresenter = Presenter.create(protoGuardConfigType)
  .presenter(async ({ config }) => ({
    object: 'protoguard.filter_config' as const,
    alert_filter_count_threshold: config.alertFilterCountThreshold,
    filters: config.filters.map(item => ({
      object: 'protoguard.filter' as const,
      id: item.id,
      key: item.key,
      name: item.name,
      description: item.description,
      issue_type: item.issueType,
      severity: item.severity,
      score_weight: item.scoreWeight,
      default_enabled: item.defaultEnabled,
      enabled: item.enabled,
      default_alert_confidence_threshold: item.defaultAlertConfidenceThreshold,
      alert_confidence_threshold: item.alertConfidenceThreshold
    }))
  }))
  .schema(
    v.object({
      object: v.literal('protoguard.filter_config'),
      alert_filter_count_threshold: v.number(),
      filters: v.array(protoGuardFilterSchema)
    })
  )
  .build();
