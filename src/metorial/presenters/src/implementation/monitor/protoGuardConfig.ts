import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { protoGuardConfigType } from '../../types';
import { protoGuardIssueTypeValidator, protoGuardSeverityValidator } from './protoGuardShared';

let protoGuardFilterSchema = v.object({
  object: v.literal('protoguard.filter'),
  id: v.string({ name: 'id', description: 'The unique identifier of the filter.' }),
  key: v.string({
    name: 'key',
    description: 'The stable key of the filter.',
    examples: ['instruction_override']
  }),
  name: v.string({ name: 'name', description: 'The display name of the filter.' }),
  description: v.nullable(
    v.string({ name: 'description', description: 'What the filter detects.' })
  ),
  issue_type: protoGuardIssueTypeValidator,
  severity: protoGuardSeverityValidator,
  score_weight: v.number({
    name: 'score_weight',
    description: 'How much a match in this filter contributes to the run score.'
  }),
  default_enabled: v.boolean({
    name: 'default_enabled',
    description: 'Whether the filter is enabled when no override exists.'
  }),
  enabled: v.boolean({
    name: 'enabled',
    description: 'Whether the filter is enabled for this instance.'
  }),
  default_alert_confidence_threshold: v.number({
    name: 'default_alert_confidence_threshold',
    description: 'The default confidence a match needs for the filter to count as triggered.'
  }),
  alert_confidence_threshold: v.number({
    name: 'alert_confidence_threshold',
    description: 'The confidence a match needs for the filter to count as triggered.'
  })
});

export let v1ProtoGuardConfigPresenter = Presenter.create(protoGuardConfigType)
  .presenter(async ({ config }) => ({
    object: 'protoguard.filter_config' as const,
    enabled: config.enabled,
    alert_probability_threshold: config.alertProbabilityThreshold,
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
      enabled: v.boolean({
        name: 'enabled',
        description:
          'Whether ProtoGuard analyzes session messages for this instance. Enabled by default.'
      }),
      alert_probability_threshold: v.number({
        name: 'alert_probability_threshold',
        description:
          'The combined injection probability, between 0 and 1, at which a message raises an alert.',
        examples: [0.8]
      }),
      alert_filter_count_threshold: v.number({
        name: 'alert_filter_count_threshold',
        description: 'The number of triggered filters at which a message raises an alert.',
        examples: [2]
      }),
      filters: v.array(protoGuardFilterSchema)
    })
  )
  .build();
