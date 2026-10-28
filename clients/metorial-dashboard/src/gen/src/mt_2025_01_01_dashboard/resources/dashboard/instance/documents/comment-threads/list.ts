import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceDocumentsCommentThreadsListOutput = {
  items: {
    object: 'document.comment_thread';
    id: string;
    documentId: string;
    status: 'open' | 'resolved';
    anchorStatus: 'attached' | 'detached';
    quote: string;
    createdById: string;
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
    };
    resolvedById: string | null;
    resolvedBy: {
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
    resolvedAt: Date | null;
    comments: {
      object: 'document.comment';
      id: string;
      threadId: string;
      body: string;
      authorId: string;
      author: {
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
      editedAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
    }[];
    createdAt: Date;
    updatedAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardInstanceDocumentsCommentThreadsListOutput =
  /* @__PURE__ */ createMapper<DashboardInstanceDocumentsCommentThreadsListOutput>(
    [
      7,
      [
        1,
        [
          'document_id',
          'anchor_status',
          'created_by_id',
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
          'resolved_by_id',
          [
            'resolved_by',
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
          'resolved_at',
          [
            'comments',
            0,
            [
              2,
              [
                1,
                [
                  'thread_id',
                  'author_id',
                  [
                    'author',
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
                                    [
                                      'assignment_id',
                                      'created_at',
                                      'updated_at'
                                    ]
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
                  'edited_at',
                  'created_at',
                  'updated_at'
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

export type DashboardInstanceDocumentsCommentThreadsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  id?: string | string[] | undefined;
  status?: 'open' | 'resolved' | ('open' | 'resolved')[] | undefined;
  anchorStatus?:
    'attached' | 'detached' | ('attached' | 'detached')[] | undefined;
  createdAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
};

export let mapDashboardInstanceDocumentsCommentThreadsListQuery =
  /* @__PURE__ */ createMapper<DashboardInstanceDocumentsCommentThreadsListQuery>(
    [3, [[0, [1, ['anchor_status', ['created_at', 1, 5]]]]]]
  );
