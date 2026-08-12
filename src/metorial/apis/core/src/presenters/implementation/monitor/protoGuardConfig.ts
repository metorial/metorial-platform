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
      id: item.filter.id,
      key: item.filter.key,
      name: item.filter.name,
      description: item.filter.description,
      issue_type: item.filter.issueType,
      severity: item.filter.severity,
      score_weight: item.filter.scoreWeight,
      default_enabled: item.filter.defaultEnabled,
      enabled: item.enabled,
      default_alert_confidence_threshold: item.filter.alertConfidenceThreshold,
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
