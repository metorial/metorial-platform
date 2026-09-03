import { v } from '@lowerdeck/validation';
import { resource } from '@metorial/audit-stash';

export type ProtoGuardFilterDefinitionSummary = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  issueType: string;
  severity: string;
  scoreWeight: number;
  defaultEnabled: boolean;
  defaultAlertConfidenceThreshold: number;
};

export let protoGuardFilterSettingAuditResource = resource({
  name: 'protoguard_filter_setting',
  payload: v.typedAny<{
    filter: ProtoGuardFilterDefinitionSummary;
    settingId: string | null;
    enabled: boolean;
    isUsingDefaultEnabled: boolean;
    alertConfidenceThreshold: number;
    isUsingDefaultConfidenceThreshold: boolean;
  }>('protoguard_filter_setting'),
  presenter: undefined,
  actions: {
    update: true
  }
});

export let protoGuardAlertThresholdAuditResource = resource({
  name: 'protoguard_alert_threshold',
  payload: v.typedAny<{
    settingId: string | null;
    alertFilterCountThreshold: number;
    isUsingDefault: boolean;
    defaultAlertFilterCountThreshold: number;
  }>('protoguard_alert_threshold'),
  presenter: undefined,
  actions: {
    update: true
  }
});

export let protoGuardAlertAuditResource = resource({
  name: 'protoguard_alert',
  payload: v.typedAny<{
    id: string;
    runId: string;
    messageId: string;
    sessionId: string;
    connectionId: string | null;
    providerRunId: string | null;
    issueTypes: string[];
    score: number;
    maxScore: number;
    confidence: number;
    triggeredFilterCount: number;
    matchedInstanceCount: number;
    alertFilterCountThreshold: number;
    alertByConfidence: boolean;
    alertByFilterCount: boolean;
    matches: {
      filter: { key: string; name: string };
      issueType: string;
      severity: string;
      confidence: number;
      confidenceThreshold: number;
      scoreWeight: number;
      path: string;
      startOffset: number;
      endOffset: number;
      description: string | null;
    }[];
    createdAt: Date;
  }>('protoguard_alert'),
  presenter: undefined,
  actions: {
    create: true
  }
});
