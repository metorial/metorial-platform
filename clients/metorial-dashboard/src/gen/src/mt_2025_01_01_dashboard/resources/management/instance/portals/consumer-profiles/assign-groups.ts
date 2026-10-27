import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type ManagementInstancePortalsConsumerProfilesAssignGroupsOutput = ({
  object: 'consumer.profile';
  id: string;
  name: string;
  email: string;
  imageUrl: string;
  consumerId: string;
  userId: string | null;
  status: 'active' | 'invited';
  createdAt: Date;
  updatedAt: Date;
} & {
  groups:
    | {
        object: 'consumer.profile.group_assignment';
        group: {
          object: 'consumer.group';
          id: string;
          status: 'active' | 'archived' | 'deleted';
          name: string;
          description: string | null;
          isDefault: boolean;
          createdAt: Date;
          updatedAt: Date;
        };
        assignedVia: 'default' | 'manual' | 'sso' | 'user';
      }[]
    | null;
}) & {
  isServiceAccount: boolean;
  organizationMember: { id: string } | null;
  surface: {
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
  } & {
    type: 'portal' | 'organization_members' | 'cli';
    portalId: string | null;
  };
};

export let mapManagementInstancePortalsConsumerProfilesAssignGroupsOutput =
  /* @__PURE__ */ createMapper<ManagementInstancePortalsConsumerProfilesAssignGroupsOutput>(
    [
      3,
      [
        [
          0,
          [
            1,
            [
              'image_url',
              'consumer_id',
              'user_id',
              'created_at',
              'updated_at',
              [
                'groups',
                0,
                [
                  2,
                  [
                    1,
                    [
                      [
                        'group',
                        0,
                        [1, ['is_default', 'created_at', 'updated_at']]
                      ],
                      'assigned_via'
                    ]
                  ]
                ]
              ],
              'is_service_account',
              'organization_member',
              [
                'surface',
                0,
                [
                  3,
                  [
                    [
                      0,
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
                            [
                              1,
                              [
                                'session_expiry_time_in_seconds',
                                'email_whitelist'
                              ]
                            ]
                          ],
                          'created_at',
                          'updated_at',
                          'portal_id'
                        ]
                      ]
                    ]
                  ]
                ]
              ]
            ]
          ]
        ]
      ]
    ],
    1
  );

export type ManagementInstancePortalsConsumerProfilesAssignGroupsBody = {
  groupIds: string[];
};

export let mapManagementInstancePortalsConsumerProfilesAssignGroupsBody =
  /* @__PURE__ */ mapObject<ManagementInstancePortalsConsumerProfilesAssignGroupsBody>(
    ['group_ids']
  );
