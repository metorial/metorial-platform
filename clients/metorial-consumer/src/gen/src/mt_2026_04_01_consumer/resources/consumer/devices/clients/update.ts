import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ConsumerDevicesClientsUpdateOutput = {
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

export let mapConsumerDevicesClientsUpdateOutput =
  /* @__PURE__ */ mapObject<ConsumerDevicesClientsUpdateOutput>(
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

export type ConsumerDevicesClientsUpdateBody = {
  enabled?: boolean | undefined;
  excludedMagicMcpServerIds?: string[] | undefined;
  excludedSkillIds?: string[] | undefined;
};

export let mapConsumerDevicesClientsUpdateBody =
  /* @__PURE__ */ mapObject<ConsumerDevicesClientsUpdateBody>([
    'excluded_magic_mcp_server_ids',
    'excluded_skill_ids'
  ]);
