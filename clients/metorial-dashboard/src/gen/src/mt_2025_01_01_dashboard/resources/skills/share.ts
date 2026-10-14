import { mapObject } from '@metorial/util-resource-mapper/compact';

export type SkillsShareOutput = {
  object: 'skill';
  id: string;
  status: 'active' | 'archived' | 'deleted';
  slug: string;
  name: string;
  description: string | null;
  imageUrl: string;
  clientName: string;
  clientDescription: string | null;
  clientMetadata: Record<string, any> | null;
  license: string | null;
  compatibility: string | null;
  metadata: Record<string, any>;
  storeId: string;
  hierarchy: {
    object: 'skill.hierarchy';
    type: 'root' | 'fork' | 'duplicated';
    parentSkillId: string | null;
    creator: {
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
    fork: {
      id: string;
      parentSkillId: string;
      creator: {
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
      originalCreator: {
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
    } | null;
    entity: {
      object: 'skill.entity';
      id: string;
      name: string;
      slug: string;
      description: string | null;
      parentSkillId: string;
      createdAt: Date;
      updatedAt: Date;
    };
  };
  integrations: {
    object: 'integration#preview';
    id: string;
    slug: string;
    name: string;
    description: string | null;
    metadata: Record<string, any> | null;
    configuration: {
      canAttachCustomToolFilters: boolean;
      canAttachCustomProviderConfig: boolean;
      canOverrideToolFilters: boolean;
      enableCallbackTools: boolean;
      useIntegrationNameInToolNames: boolean | null;
    };
    createdAt: Date;
    updatedAt: Date;
    archivedAt: Date | null;
  }[];
  providers: {
    object: 'provider#preview';
    id: string;
    name: string;
    description: string | null;
    slug: string;
    createdAt: Date;
    updatedAt: Date;
  }[];
  createdAt: Date;
  updatedAt: Date;
};

export let mapSkillsShareOutput = /* @__PURE__ */ mapObject<SkillsShareOutput>(
  [
    'image_url',
    'client_name',
    'client_description',
    'client_metadata',
    'store_id',
    [
      'hierarchy',
      0,
      [
        1,
        [
          'parent_skill_id',
          [
            'creator',
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
          [
            'fork',
            0,
            [
              1,
              [
                'parent_skill_id',
                [
                  'creator',
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
                              [
                                2,
                                [
                                  1,
                                  ['assignment_id', 'created_at', 'updated_at']
                                ]
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
                        [
                          1,
                          ['image_url', 'user_id', 'created_at', 'updated_at']
                        ]
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
                [
                  'original_creator',
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
                                [
                                  1,
                                  ['assignment_id', 'created_at', 'updated_at']
                                ]
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
                        [
                          1,
                          ['image_url', 'user_id', 'created_at', 'updated_at']
                        ]
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
                'created_at'
              ]
            ]
          ],
          ['entity', 0, [1, ['parent_skill_id', 'created_at', 'updated_at']]]
        ]
      ]
    ],
    [
      'integrations',
      0,
      [
        2,
        [
          1,
          [
            [
              'configuration',
              0,
              [
                1,
                [
                  'can_attach_custom_tool_filters',
                  'can_attach_custom_provider_config',
                  'can_override_tool_filters',
                  'enable_callback_tools',
                  'use_integration_name_in_tool_names'
                ]
              ]
            ],
            'created_at',
            'updated_at',
            'archived_at'
          ]
        ]
      ]
    ],
    ['providers', 0, [2, 8]],
    'created_at',
    'updated_at'
  ],
  1
);

export type SkillsShareBody = {
  consumerProfileIds?: string[] | undefined;
  organizationMemberIds?: string[] | undefined;
  permission: 'none' | 'read' | 'write';
};

export let mapSkillsShareBody = /* @__PURE__ */ mapObject<SkillsShareBody>([
  'consumer_profile_ids',
  'organization_member_ids'
]);
