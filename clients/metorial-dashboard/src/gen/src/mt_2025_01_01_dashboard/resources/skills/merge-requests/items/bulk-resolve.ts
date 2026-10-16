import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type SkillsMergeRequestsItemsBulkResolveOutput = {
  items: {
    object: 'skill.merge_request.item';
    id: string;
    skillMergeRequestId: string;
    path: string;
    kind: 'file' | 'document' | 'directory';
    changeType: 'added' | 'modified' | 'removed' | 'unchanged' | 'conflicted';
    status: 'unresolved' | 'resolved' | 'skipped' | 'applied';
    resolutionType:
      | 'accept_source'
      | 'keep_target'
      | 'remove'
      | 'edit_document'
      | 'replace_file'
      | 'skip'
      | null;
    conflictReason: string | null;
    resolution: Record<string, any> | null;
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
    appliedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapSkillsMergeRequestsItemsBulkResolveOutput =
  /* @__PURE__ */ createMapper<SkillsMergeRequestsItemsBulkResolveOutput>(
    [
      7,
      [
        1,
        [
          'skill_merge_request_id',
          'change_type',
          'resolution_type',
          'conflict_reason',
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
          'applied_at',
          'created_at',
          'updated_at'
        ]
      ]
    ],
    1
  );

export type SkillsMergeRequestsItemsBulkResolveBody = {
  items: {
    itemId: string;
    resolutionType:
      | 'accept_source'
      | 'keep_target'
      | 'remove'
      | 'edit_document'
      | 'replace_file'
      | 'skip';
    resolution?:
      | {
          title?: string | undefined;
          content?: string | undefined;
          fileId?: string | undefined;
        }
      | null
      | undefined;
  }[];
};

export let mapSkillsMergeRequestsItemsBulkResolveBody =
  /* @__PURE__ */ mapObject<SkillsMergeRequestsItemsBulkResolveBody>([
    ['items', 0, [2, [1, ['item_id', 'resolution_type']]]]
  ]);
