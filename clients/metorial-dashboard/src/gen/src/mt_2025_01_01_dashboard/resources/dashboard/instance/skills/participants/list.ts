import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceSkillsParticipantsListOutput = {
  items: {
    object: 'skill.participant';
    id: string;
    skillId: string;
    roles: ('creator' | 'editor' | 'viewer' | 'user' | 'forker')[];
    actor: {
      type: 'organization_actor' | 'consumer' | 'resource_actor';
      name: string;
      imageUrl: string | null;
      email: string | null;
      organizationActor: {
        object: 'organization.actor';
        id: string;
        type: 'member' | 'machine_access';
        organizationId: string;
        name: string;
        email: string | null;
        imageUrl: string;
        member: {
          object: 'organization.member#preview';
          id: string;
          status: 'active' | 'deleted';
          role: 'member' | 'admin';
        } | null;
        teams: {
          id: string;
          name: string;
          slug: string;
          assignmentId: string;
          createdAt: Date;
          updatedAt: Date;
        }[];
        createdAt: Date;
        updatedAt: Date;
      } | null;
      consumer: {
        object: 'consumer';
        id: string;
        name: string;
        email: string;
        imageUrl: string;
        userId: string | null;
        createdAt: Date;
        updatedAt: Date;
      } | null;
      consumerProfile:
        | ({
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
          })
        | null;
    };
    createdAt: Date;
    updatedAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardInstanceSkillsParticipantsListOutput =
  /* @__PURE__ */ createMapper<DashboardInstanceSkillsParticipantsListOutput>(
    [
      7,
      [
        1,
        [
          'skill_id',
          [
            'actor',
            0,
            [
              1,
              [
                'image_url',
                [
                  'organization_actor',
                  1,
                  [
                    1,
                    [
                      'organization_id',
                      'image_url',
                      [
                        'teams',
                        0,
                        [2, [1, ['assignment_id', 'created_at', 'updated_at']]]
                      ],
                      'created_at',
                      'updated_at'
                    ]
                  ]
                ],
                [
                  'consumer',
                  0,
                  [1, ['image_url', 'user_id', 'created_at', 'updated_at']]
                ],
                [
                  'consumer_profile',
                  1,
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
                                      [
                                        1,
                                        [
                                          'is_default',
                                          'created_at',
                                          'updated_at'
                                        ]
                                      ]
                                    ],
                                    'assigned_via'
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
              ]
            ]
          ],
          'created_at',
          'updated_at'
        ]
      ]
    ],
    1
  );

export type DashboardInstanceSkillsParticipantsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {};

export let mapDashboardInstanceSkillsParticipantsListQuery =
  /* @__PURE__ */ createMapper<DashboardInstanceSkillsParticipantsListQuery>(0);
