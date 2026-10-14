import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceConversationsListOutput = {
  items: {
    object: 'assistant.conversation';
    id: string;
    title: string | null;
    assistantId: string;
    instanceId: string;
    organizationId: string;
    createdByActor: {
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
    rootMessageId: string;
    assistant: {
      object: 'assistant';
      id: string;
      slug: string;
      name: string;
      ownerType: 'metorial' | 'organization';
      organizationId: string | null;
      defaultModel: {
        object: 'assistant.model';
        id: string;
        slug: string;
        name: string;
        contextWindow: number;
        provider: {
          object: 'assistant.model_provider';
          id: string;
          slug: string;
          name: string;
          imageUrl: string;
        };
      } | null;
      availableModels: {
        object: 'assistant.model';
        id: string;
        slug: string;
        name: string;
        contextWindow: number;
        provider: {
          object: 'assistant.model_provider';
          id: string;
          slug: string;
          name: string;
          imageUrl: string;
        };
      }[];
      createdAt: Date;
      updatedAt: Date;
    };
    createdAt: Date;
    updatedAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapManagementInstanceConversationsListOutput =
  /* @__PURE__ */ createMapper<ManagementInstanceConversationsListOutput>(
    [
      7,
      [
        1,
        [
          'assistant_id',
          'instance_id',
          'organization_id',
          [
            'created_by_actor',
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
          'root_message_id',
          [
            'assistant',
            0,
            [
              1,
              [
                'owner_type',
                'organization_id',
                [
                  'default_model',
                  1,
                  [1, ['context_window', ['provider', 0, [1, ['image_url']]]]]
                ],
                [
                  'available_models',
                  1,
                  [
                    2,
                    [1, ['context_window', ['provider', 0, [1, ['image_url']]]]]
                  ]
                ],
                'created_at',
                'updated_at'
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

export type ManagementInstanceConversationsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & { assistantId?: string | string[] | undefined };

export let mapManagementInstanceConversationsListQuery =
  /* @__PURE__ */ createMapper<ManagementInstanceConversationsListQuery>([
    3,
    [[0, [1, ['assistant_id']]]]
  ]);
