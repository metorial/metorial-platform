import { createMapper } from '@metorial/util-resource-mapper/compact';

export type SkillsMergeRequestsEventsListOutput = {
  items: {
    object: 'skill.merge_request.event';
    id: string;
    type:
      | 'created'
      | 'commented'
      | 'all_conflicts_resolved'
      | 'merge_started'
      | 'merge_completed'
      | 'merge_failed'
      | 'closed'
      | 'rolled_back';
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
    } | null;
    comment: {
      object: 'skill.merge_request.comment';
      id: string;
      skillMergeRequestItemId: string | null;
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
      body: string;
      path: string | null;
      inReplyToCommentId: string | null;
      deletedAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
    } | null;
    errorCode:
      | 'target_changed'
      | 'unresolved_after_refresh'
      | 'apply_failed'
      | 'verification_failed'
      | 'enqueue_failed'
      | 'stale_merge_recovered'
      | null;
    errorMessage: string | null;
    createdAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapSkillsMergeRequestsEventsListOutput =
  /* @__PURE__ */ createMapper<SkillsMergeRequestsEventsListOutput>(
    [
      7,
      [
        1,
        [
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
          [
            'comment',
            0,
            [
              1,
              [
                'skill_merge_request_item_id',
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
                'in_reply_to_comment_id',
                'deleted_at',
                'created_at',
                'updated_at'
              ]
            ]
          ],
          'error_code',
          'error_message',
          'created_at'
        ]
      ]
    ],
    1
  );

export type SkillsMergeRequestsEventsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  type?:
    | 'created'
    | 'commented'
    | 'all_conflicts_resolved'
    | 'merge_started'
    | 'merge_completed'
    | 'merge_failed'
    | 'closed'
    | 'rolled_back'
    | (
        | 'created'
        | 'commented'
        | 'all_conflicts_resolved'
        | 'merge_started'
        | 'merge_completed'
        | 'merge_failed'
        | 'closed'
        | 'rolled_back'
      )[]
    | undefined;
  createdAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
};

export let mapSkillsMergeRequestsEventsListQuery =
  /* @__PURE__ */ createMapper<SkillsMergeRequestsEventsListQuery>([
    3,
    [[0, [1, [['created_at', 1, 5]]]]]
  ]);
