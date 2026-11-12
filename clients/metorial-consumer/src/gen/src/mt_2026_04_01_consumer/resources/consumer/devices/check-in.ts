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
  lastSeenAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export let mapConsumerDevicesCheckInOutput =
  /* @__PURE__ */ mapObject<ConsumerDevicesCheckInOutput>(
    [
      'consumer_profile_id',
      'app_version',
      [
        'clients',
        0,
        [
          2,
          [
            1,
            [
              'supports_skills',
              'excluded_magic_mcp_server_ids',
              'excluded_skill_ids'
            ]
          ]
        ]
      ],
      'last_seen_at',
      'revoked_at',
      'created_at',
      'updated_at'
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
