import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceSkillsMergeRequestsRollbackOutput = {
  object: 'skill.merge_request';
  id: string;
  status: 'open' | 'closed' | 'merging' | 'merged';
  direction: 'fork_to_upstream' | 'upstream_to_fork';
  baseStrategy: 'exact' | 'inferred_created_at' | 'inferred_current';
  title: string;
  description: string | null;
  mergeError: string | null;
  mergeErrorCode:
    | 'target_changed'
    | 'unresolved_after_refresh'
    | 'apply_failed'
    | 'verification_failed'
    | 'enqueue_failed'
    | 'stale_merge_recovered'
    | null;
  sourceSkillId: string;
  targetSkillId: string;
  baseTargetSkillVersionId: string;
  requestedSourceSkillVersionId: string;
  requestedTargetSkillVersionId: string;
  preMergeTargetSkillVersionId: string | null;
  mergedTargetSkillVersionId: string | null;
  rollbackTargetSkillVersionId: string | null;
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
  itemCount: number;
  commentCount: number;
  mergeStartedAt: Date | null;
  mergedAt: Date | null;
  closedAt: Date | null;
  rolledBackAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementInstanceSkillsMergeRequestsRollbackOutput =
  /* @__PURE__ */ mapObject<ManagementInstanceSkillsMergeRequestsRollbackOutput>(
    [
      'base_strategy',
      'merge_error',
      'merge_error_code',
      'source_skill_id',
      'target_skill_id',
      'base_target_skill_version_id',
      'requested_source_skill_version_id',
      'requested_target_skill_version_id',
      'pre_merge_target_skill_version_id',
      'merged_target_skill_version_id',
      'rollback_target_skill_version_id',
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
      'item_count',
      'comment_count',
      'merge_started_at',
      'merged_at',
      'closed_at',
      'rolled_back_at',
      'created_at',
      'updated_at'
    ],
    1
  );
