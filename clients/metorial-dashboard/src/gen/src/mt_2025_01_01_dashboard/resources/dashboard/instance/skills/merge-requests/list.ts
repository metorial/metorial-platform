import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceSkillsMergeRequestsListOutput = {
  items: {
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
                    ssoGroupIds: string[];
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
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardInstanceSkillsMergeRequestsListOutput =
  mtMap.object<DashboardInstanceSkillsMergeRequestsListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          status: mtMap.objectField('status', mtMap.passthrough()),
          direction: mtMap.objectField('direction', mtMap.passthrough()),
          baseStrategy: mtMap.objectField('base_strategy', mtMap.passthrough()),
          title: mtMap.objectField('title', mtMap.passthrough()),
          description: mtMap.objectField('description', mtMap.passthrough()),
          mergeError: mtMap.objectField('merge_error', mtMap.passthrough()),
          mergeErrorCode: mtMap.objectField(
            'merge_error_code',
            mtMap.passthrough()
          ),
          sourceSkillId: mtMap.objectField(
            'source_skill_id',
            mtMap.passthrough()
          ),
          targetSkillId: mtMap.objectField(
            'target_skill_id',
            mtMap.passthrough()
          ),
          baseTargetSkillVersionId: mtMap.objectField(
            'base_target_skill_version_id',
            mtMap.passthrough()
          ),
          requestedSourceSkillVersionId: mtMap.objectField(
            'requested_source_skill_version_id',
            mtMap.passthrough()
          ),
          requestedTargetSkillVersionId: mtMap.objectField(
            'requested_target_skill_version_id',
            mtMap.passthrough()
          ),
          preMergeTargetSkillVersionId: mtMap.objectField(
            'pre_merge_target_skill_version_id',
            mtMap.passthrough()
          ),
          mergedTargetSkillVersionId: mtMap.objectField(
            'merged_target_skill_version_id',
            mtMap.passthrough()
          ),
          rollbackTargetSkillVersionId: mtMap.objectField(
            'rollback_target_skill_version_id',
            mtMap.passthrough()
          ),
          createdBy: mtMap.objectField(
            'created_by',
            mtMap.object({
              type: mtMap.objectField('type', mtMap.passthrough()),
              name: mtMap.objectField('name', mtMap.passthrough()),
              imageUrl: mtMap.objectField('image_url', mtMap.passthrough()),
              email: mtMap.objectField('email', mtMap.passthrough()),
              organizationActor: mtMap.objectField(
                'organization_actor',
                mtMap.object({
                  object: mtMap.objectField('object', mtMap.passthrough()),
                  id: mtMap.objectField('id', mtMap.passthrough()),
                  type: mtMap.objectField('type', mtMap.passthrough()),
                  organizationId: mtMap.objectField(
                    'organization_id',
                    mtMap.passthrough()
                  ),
                  name: mtMap.objectField('name', mtMap.passthrough()),
                  email: mtMap.objectField('email', mtMap.passthrough()),
                  imageUrl: mtMap.objectField('image_url', mtMap.passthrough()),
                  member: mtMap.objectField(
                    'member',
                    mtMap.object({
                      object: mtMap.objectField('object', mtMap.passthrough()),
                      id: mtMap.objectField('id', mtMap.passthrough()),
                      status: mtMap.objectField('status', mtMap.passthrough()),
                      role: mtMap.objectField('role', mtMap.passthrough())
                    })
                  ),
                  teams: mtMap.objectField(
                    'teams',
                    mtMap.array(
                      mtMap.object({
                        id: mtMap.objectField('id', mtMap.passthrough()),
                        name: mtMap.objectField('name', mtMap.passthrough()),
                        slug: mtMap.objectField('slug', mtMap.passthrough()),
                        assignmentId: mtMap.objectField(
                          'assignment_id',
                          mtMap.passthrough()
                        ),
                        createdAt: mtMap.objectField(
                          'created_at',
                          mtMap.date()
                        ),
                        updatedAt: mtMap.objectField('updated_at', mtMap.date())
                      })
                    )
                  ),
                  createdAt: mtMap.objectField('created_at', mtMap.date()),
                  updatedAt: mtMap.objectField('updated_at', mtMap.date())
                })
              ),
              consumer: mtMap.objectField(
                'consumer',
                mtMap.object({
                  object: mtMap.objectField('object', mtMap.passthrough()),
                  id: mtMap.objectField('id', mtMap.passthrough()),
                  name: mtMap.objectField('name', mtMap.passthrough()),
                  email: mtMap.objectField('email', mtMap.passthrough()),
                  imageUrl: mtMap.objectField('image_url', mtMap.passthrough()),
                  userId: mtMap.objectField('user_id', mtMap.passthrough()),
                  createdAt: mtMap.objectField('created_at', mtMap.date()),
                  updatedAt: mtMap.objectField('updated_at', mtMap.date())
                })
              ),
              consumerProfile: mtMap.objectField(
                'consumer_profile',
                mtMap.union([
                  mtMap.unionOption(
                    'object',
                    mtMap.object({
                      object: mtMap.objectField('object', mtMap.passthrough()),
                      id: mtMap.objectField('id', mtMap.passthrough()),
                      name: mtMap.objectField('name', mtMap.passthrough()),
                      email: mtMap.objectField('email', mtMap.passthrough()),
                      imageUrl: mtMap.objectField(
                        'image_url',
                        mtMap.passthrough()
                      ),
                      consumerId: mtMap.objectField(
                        'consumer_id',
                        mtMap.passthrough()
                      ),
                      userId: mtMap.objectField('user_id', mtMap.passthrough()),
                      status: mtMap.objectField('status', mtMap.passthrough()),
                      createdAt: mtMap.objectField('created_at', mtMap.date()),
                      updatedAt: mtMap.objectField('updated_at', mtMap.date()),
                      groups: mtMap.objectField(
                        'groups',
                        mtMap.array(
                          mtMap.object({
                            object: mtMap.objectField(
                              'object',
                              mtMap.passthrough()
                            ),
                            group: mtMap.objectField(
                              'group',
                              mtMap.object({
                                object: mtMap.objectField(
                                  'object',
                                  mtMap.passthrough()
                                ),
                                id: mtMap.objectField(
                                  'id',
                                  mtMap.passthrough()
                                ),
                                status: mtMap.objectField(
                                  'status',
                                  mtMap.passthrough()
                                ),
                                name: mtMap.objectField(
                                  'name',
                                  mtMap.passthrough()
                                ),
                                description: mtMap.objectField(
                                  'description',
                                  mtMap.passthrough()
                                ),
                                isDefault: mtMap.objectField(
                                  'is_default',
                                  mtMap.passthrough()
                                ),
                                ssoGroupIds: mtMap.objectField(
                                  'sso_group_ids',
                                  mtMap.array(mtMap.passthrough())
                                ),
                                createdAt: mtMap.objectField(
                                  'created_at',
                                  mtMap.date()
                                ),
                                updatedAt: mtMap.objectField(
                                  'updated_at',
                                  mtMap.date()
                                )
                              })
                            ),
                            assignedVia: mtMap.objectField(
                              'assigned_via',
                              mtMap.passthrough()
                            )
                          })
                        )
                      )
                    })
                  )
                ])
              )
            })
          ),
          itemCount: mtMap.objectField('item_count', mtMap.passthrough()),
          commentCount: mtMap.objectField('comment_count', mtMap.passthrough()),
          mergeStartedAt: mtMap.objectField('merge_started_at', mtMap.date()),
          mergedAt: mtMap.objectField('merged_at', mtMap.date()),
          closedAt: mtMap.objectField('closed_at', mtMap.date()),
          rolledBackAt: mtMap.objectField('rolled_back_at', mtMap.date()),
          createdAt: mtMap.objectField('created_at', mtMap.date()),
          updatedAt: mtMap.objectField('updated_at', mtMap.date())
        })
      )
    ),
    pagination: mtMap.objectField(
      'pagination',
      mtMap.object({
        hasMoreBefore: mtMap.objectField(
          'has_more_before',
          mtMap.passthrough()
        ),
        hasMoreAfter: mtMap.objectField('has_more_after', mtMap.passthrough())
      })
    )
  });

export type DashboardInstanceSkillsMergeRequestsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  id?: string | string[] | undefined;
  sourceSkillId?: string | string[] | undefined;
  targetSkillId?: string | string[] | undefined;
  status?:
    | 'open'
    | 'closed'
    | 'merging'
    | 'merged'
    | ('open' | 'closed' | 'merging' | 'merged')[]
    | undefined;
  createdByActorId?: string | string[] | undefined;
  createdAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
};

export let mapDashboardInstanceSkillsMergeRequestsListQuery = mtMap.union([
  mtMap.unionOption(
    'object',
    mtMap.object({
      limit: mtMap.objectField('limit', mtMap.passthrough()),
      after: mtMap.objectField('after', mtMap.passthrough()),
      before: mtMap.objectField('before', mtMap.passthrough()),
      cursor: mtMap.objectField('cursor', mtMap.passthrough()),
      order: mtMap.objectField('order', mtMap.passthrough()),
      id: mtMap.objectField(
        'id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      sourceSkillId: mtMap.objectField(
        'source_skill_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      targetSkillId: mtMap.objectField(
        'target_skill_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      status: mtMap.objectField(
        'status',
        mtMap.union([mtMap.unionOption('array', mtMap.union([]))])
      ),
      createdByActorId: mtMap.objectField(
        'created_by_actor_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      createdAt: mtMap.objectField(
        'created_at',
        mtMap.object({
          gt: mtMap.objectField('gt', mtMap.date()),
          lt: mtMap.objectField('lt', mtMap.date())
        })
      )
    })
  )
]);

