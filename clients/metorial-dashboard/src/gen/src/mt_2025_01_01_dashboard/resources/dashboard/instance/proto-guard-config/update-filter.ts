import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceProtoGuardConfigUpdateFilterOutput = {
  object: 'protoguard.filter_config';
  alertFilterCountThreshold: number;
  filters: {
    object: 'protoguard.filter';
    id: string;
    key: string;
    name: string;
    description: string | null;
    issueType:
      | 'instruction_override'
      | 'role_hijack'
      | 'jailbreak_persona'
      | 'prompt_exfiltration'
      | 'tool_call_forgery'
      | 'format_break'
      | 'instruction_block'
      | 'unicode_smuggling'
      | 'encoded_payload'
      | 'typoglycemia';
    severity: 'low' | 'medium' | 'high' | 'critical';
    scoreWeight: number;
    defaultEnabled: boolean;
    enabled: boolean;
    defaultAlertConfidenceThreshold: number;
    alertConfidenceThreshold: number;
  }[];
};

export let mapDashboardInstanceProtoGuardConfigUpdateFilterOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceProtoGuardConfigUpdateFilterOutput>(
    [
      'alert_filter_count_threshold',
      [
        'filters',
        0,
        [
          2,
          [
            1,
            [
              'issue_type',
              'score_weight',
              'default_enabled',
              'default_alert_confidence_threshold',
              'alert_confidence_threshold'
            ]
          ]
        ]
      ]
    ]
  );

export type DashboardInstanceProtoGuardConfigUpdateFilterBody = {
  enabled?: boolean | undefined;
  alertConfidenceThreshold?: number | null | undefined;
};

export let mapDashboardInstanceProtoGuardConfigUpdateFilterBody =
  /* @__PURE__ */ mapObject<DashboardInstanceProtoGuardConfigUpdateFilterBody>([
    'alert_confidence_threshold'
  ]);
