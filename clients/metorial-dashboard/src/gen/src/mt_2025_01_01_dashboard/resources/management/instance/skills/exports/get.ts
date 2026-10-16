import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceSkillsExportsGetOutput = {
  object: 'skill.export';
  id: string;
  target: 'skill' | 'plugin' | 'marketplace';
  status: 'pending' | 'completed' | 'failed';
  file: {
    object: 'file';
    id: string;
    status: 'active' | 'deleted';
    fileName: string;
    fileSize: number;
    fileType: string;
    title: string;
    purpose: string;
    createdBy: {
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
    } | null;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  fileLink: {
    object: 'file.file_link';
    id: string;
    fileId: string;
    url: string;
    createdAt: Date;
    expiresAt: Date | null;
  } | null;
  createdBy: {
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
  } | null;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
};

export let mapManagementInstanceSkillsExportsGetOutput =
  /* @__PURE__ */ mapObject<ManagementInstanceSkillsExportsGetOutput>(
    [
      [
        'file',
        0,
        [
          1,
          [
            'file_name',
            'file_size',
            'file_type',
            [
              'created_by',
              1,
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
                          [
                            2,
                            [1, ['assignment_id', 'created_at', 'updated_at']]
                          ]
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
      ['file_link', 1, [1, ['file_id', 'created_at', 'expires_at']]],
      [
        'created_by',
        1,
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
                                    ['is_default', 'created_at', 'updated_at']
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
      'started_at',
      'completed_at'
    ],
    1
  );
