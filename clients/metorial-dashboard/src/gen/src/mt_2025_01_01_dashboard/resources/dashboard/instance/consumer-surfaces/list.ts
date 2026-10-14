import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceConsumerSurfacesListOutput = {
  items: {
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
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardInstanceConsumerSurfacesListOutput =
  /* @__PURE__ */ createMapper<DashboardInstanceConsumerSurfacesListOutput>(
    [
      7,
      [
        1,
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
          [
            'auth',
            0,
            [1, ['session_expiry_time_in_seconds', 'email_whitelist']]
          ],
          'created_at',
          'updated_at'
        ]
      ]
    ],
    1
  );

export type DashboardInstanceConsumerSurfacesListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {};

export let mapDashboardInstanceConsumerSurfacesListQuery =
  /* @__PURE__ */ createMapper<DashboardInstanceConsumerSurfacesListQuery>(0);
