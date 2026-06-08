import { mtMap } from '@metorial/util-resource-mapper';

export type ProtoGuardConfigUpdateFilterOutput = {
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

export let mapProtoGuardConfigUpdateFilterOutput =
  mtMap.object<ProtoGuardConfigUpdateFilterOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    alertFilterCountThreshold: mtMap.objectField(
      'alert_filter_count_threshold',
      mtMap.passthrough()
    ),
    filters: mtMap.objectField(
      'filters',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          key: mtMap.objectField('key', mtMap.passthrough()),
          name: mtMap.objectField('name', mtMap.passthrough()),
          description: mtMap.objectField('description', mtMap.passthrough()),
          issueType: mtMap.objectField('issue_type', mtMap.passthrough()),
          severity: mtMap.objectField('severity', mtMap.passthrough()),
          scoreWeight: mtMap.objectField('score_weight', mtMap.passthrough()),
          defaultEnabled: mtMap.objectField(
            'default_enabled',
            mtMap.passthrough()
          ),
          enabled: mtMap.objectField('enabled', mtMap.passthrough()),
          defaultAlertConfidenceThreshold: mtMap.objectField(
            'default_alert_confidence_threshold',
            mtMap.passthrough()
          ),
          alertConfidenceThreshold: mtMap.objectField(
            'alert_confidence_threshold',
            mtMap.passthrough()
          )
        })
      )
    )
  });

export type ProtoGuardConfigUpdateFilterBody = {
  enabled?: boolean | undefined;
  alertConfidenceThreshold?: number | null | undefined;
};

export let mapProtoGuardConfigUpdateFilterBody =
  mtMap.object<ProtoGuardConfigUpdateFilterBody>({
    enabled: mtMap.objectField('enabled', mtMap.passthrough()),
    alertConfidenceThreshold: mtMap.objectField(
      'alert_confidence_threshold',
      mtMap.passthrough()
    )
  });

