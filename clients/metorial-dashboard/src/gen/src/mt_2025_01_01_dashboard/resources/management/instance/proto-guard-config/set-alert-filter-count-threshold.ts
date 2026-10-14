import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceProtoGuardConfigSetAlertFilterCountThresholdOutput =
  {
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

export let mapManagementInstanceProtoGuardConfigSetAlertFilterCountThresholdOutput =
  /* @__PURE__ */ mapObject<ManagementInstanceProtoGuardConfigSetAlertFilterCountThresholdOutput>(
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

export type ManagementInstanceProtoGuardConfigSetAlertFilterCountThresholdBody =
  { threshold: number | null };

export let mapManagementInstanceProtoGuardConfigSetAlertFilterCountThresholdBody =
  /* @__PURE__ */ createMapper<ManagementInstanceProtoGuardConfigSetAlertFilterCountThresholdBody>(
    0
  );
