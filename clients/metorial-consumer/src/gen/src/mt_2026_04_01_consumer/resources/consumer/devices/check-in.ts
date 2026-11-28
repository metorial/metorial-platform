import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ConsumerDevicesCheckInOutput = {
  object: 'consumer.device';
  id: string;
  status: 'active' | 'signed_out' | 'revoked';
  consumerProfileId: string;
  name: string;
  os: string;
  arch: string;
  appVersion: string;
  clients: {
    object: 'consumer.device.client';
    key: string;
    name: string;
    detected: boolean;
    installable: boolean;
    supportsSkills: boolean;
    enabled: boolean;
    excludedMagicMcpServerIds: string[];
    excludedSkillIds: string[];
  }[];
  detections: {
    object: 'consumer.device.detection';
    id: string;
    toolKey: string;
    toolName: string;
    state: 'installed' | 'running';
    confidence: 'high' | 'medium' | 'low';
    signalKinds: ('config_dir' | 'app' | 'path' | 'ide_extension' | 'process')[];
    version: string | null;
    stale: boolean;
    firstSeenAt: Date;
    lastSeenAt: Date;
  }[];
  lastSeenAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  telemetry: {
    enabled: boolean;
    tokenId: string | null;
    toolDetails: boolean;
    sessionContext: boolean;
    sessionTitles: boolean;
    historyImport: boolean;
    historyImportDays: number;
  };
  monitor: {
    aiToolDetection: boolean;
    catalogVersion: string;
    intervals: {
      configDirs: number;
      apps: number;
      binaries: number;
      ideExtensions: number;
      processes: number;
      report: number;
    };
  };
  install: { connectionMode: 'local_proxy' | 'direct' };
};

export let mapConsumerDevicesCheckInOutput =
  /* @__PURE__ */ mapObject<ConsumerDevicesCheckInOutput>(
    [
      'consumer_profile_id',
      'app_version',
      [
        'clients',
        0,
        [2, [1, ['supports_skills', 'excluded_magic_mcp_server_ids', 'excluded_skill_ids']]]
      ],
      [
        'detections',
        0,
        [2, [1, ['tool_key', 'tool_name', 'signal_kinds', 'first_seen_at', 'last_seen_at']]]
      ],
      'last_seen_at',
      'revoked_at',
      'created_at',
      'updated_at',
      [
        'telemetry',
        0,
        [
          1,
          [
            'token_id',
            'tool_details',
            'session_context',
            'session_titles',
            'history_import',
            'history_import_days'
          ]
        ]
      ],
      [
        'monitor',
        0,
        [
          1,
          [
            'ai_tool_detection',
            'catalog_version',
            ['intervals', 0, [1, ['config_dirs', 'ide_extensions']]]
          ]
        ]
      ],
      ['install', 0, [1, ['connection_mode']]]
    ],
    1
  );

export type ConsumerDevicesCheckInBody = {
  installationId: string;
  name: string;
  os: string;
  arch: string;
  appVersion: string;
  clients: {
    key: string;
    name: string;
    detected: boolean;
    installable: boolean;
    supportsSkills: boolean;
  }[];
  magicMcpTokenIds?: string[] | undefined;
};

export let mapConsumerDevicesCheckInBody =
  /* @__PURE__ */ mapObject<ConsumerDevicesCheckInBody>([
    'installation_id',
    'app_version',
    ['clients', 0, [2, [1, ['supports_skills']]]],
    'magic_mcp_token_ids'
  ]);
