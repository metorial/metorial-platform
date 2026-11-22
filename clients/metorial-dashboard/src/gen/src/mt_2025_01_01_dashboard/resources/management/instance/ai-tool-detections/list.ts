import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceAiToolDetectionsListOutput = {
  object: 'list';
  items: {
    object: 'ai_tool.detection';
    id: string;
    toolKey: string;
    toolName: string;
    state: 'installed' | 'running';
    confidence: 'high' | 'medium' | 'low';
    signalKinds: (
      'config_dir' | 'app' | 'path' | 'ide_extension' | 'process'
    )[];
    version: string | null;
    stale: boolean;
    firstSeenAt: Date;
    lastSeenAt: Date;
    policyStatus: 'sanctioned' | 'not_sanctioned' | 'unreviewed';
    consumerDeviceId: string;
    consumerDeviceName: string;
    consumerDeviceOs: string;
    consumerProfileId: string;
    consumerId: string;
    consumerName: string;
    consumerEmail: string;
    goneAt: Date | null;
    activelyUsed: boolean | null;
    lastUsedAt: Date | null;
  }[];
  pagination: {
    hasMoreBefore: boolean;
    hasMoreAfter: boolean;
    before?: string | undefined;
    after?: string | undefined;
  };
};

export let mapManagementInstanceAiToolDetectionsListOutput =
  /* @__PURE__ */ createMapper<ManagementInstanceAiToolDetectionsListOutput>(
    [
      7,
      [
        1,
        [
          'tool_key',
          'tool_name',
          'signal_kinds',
          'first_seen_at',
          'last_seen_at',
          'policy_status',
          'consumer_device_id',
          'consumer_device_name',
          'consumer_device_os',
          'consumer_profile_id',
          'consumer_id',
          'consumer_name',
          'consumer_email',
          'gone_at',
          'actively_used',
          'last_used_at'
        ]
      ]
    ],
    1
  );

export type ManagementInstanceAiToolDetectionsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  consumerId?: string | string[] | undefined;
  consumerProfileId?: string | string[] | undefined;
  consumerDeviceId?: string | string[] | undefined;
  toolKey?: string | string[] | undefined;
  policyStatus?:
    | 'sanctioned'
    | 'not_sanctioned'
    | 'unreviewed'
    | ('sanctioned' | 'not_sanctioned' | 'unreviewed')[]
    | undefined;
  status?: 'present' | 'gone' | ('present' | 'gone')[] | undefined;
};

export let mapManagementInstanceAiToolDetectionsListQuery =
  /* @__PURE__ */ createMapper<ManagementInstanceAiToolDetectionsListQuery>([
    3,
    [
      [
        0,
        [
          1,
          [
            'consumer_id',
            'consumer_profile_id',
            'consumer_device_id',
            'tool_key',
            'policy_status'
          ]
        ]
      ]
    ]
  ]);
