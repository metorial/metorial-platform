import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceConsumerSurfacesGetOutput = {
  object: 'consumer.surface';
  id: string;
  status: 'active' | 'archived' | 'deleted';
  name: string;
  description: string | null;
  allowConsumerSkillAuthoring: boolean;
  allowConsumerSkillPublishing: boolean;
  skillConfiguration: {
    id: string;
    isDefault: boolean;
    allowScripts: boolean;
    allowedFileExtensions: string[];
    allowNonStandardDirectories: boolean;
  };
  auth: {
    object: 'consumer.surface.auth';
    sessionExpiryTimeInSeconds: number;
    emailWhitelist: string[];
  };
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementInstanceConsumerSurfacesGetOutput =
  /* @__PURE__ */ mapObject<ManagementInstanceConsumerSurfacesGetOutput>(
    [
      'allow_consumer_skill_authoring',
      'allow_consumer_skill_publishing',
      [
        'skill_configuration',
        1,
        [
          1,
          [
            'is_default',
            'allow_scripts',
            'allowed_file_extensions',
            'allow_non_standard_directories'
          ]
        ]
      ],
      ['auth', 0, [1, ['session_expiry_time_in_seconds', 'email_whitelist']]],
      'created_at',
      'updated_at'
    ],
    1
  );
