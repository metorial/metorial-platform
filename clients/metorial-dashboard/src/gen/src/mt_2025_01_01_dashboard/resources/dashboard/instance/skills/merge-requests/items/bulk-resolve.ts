import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceSkillsMergeRequestsItemsBulkResolveOutput = {
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

export let mapDashboardInstanceSkillsMergeRequestsItemsBulkResolveOutput =
  mtMap.object<DashboardInstanceSkillsMergeRequestsItemsBulkResolveOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          skillMergeRequestId: mtMap.objectField(
            'skill_merge_request_id',
            mtMap.passthrough()
          ),
          path: mtMap.objectField('path', mtMap.passthrough()),
          kind: mtMap.objectField('kind', mtMap.passthrough()),
          changeType: mtMap.objectField('change_type', mtMap.passthrough()),
          status: mtMap.objectField('status', mtMap.passthrough()),
          resolutionType: mtMap.objectField(
            'resolution_type',
            mtMap.passthrough()
          ),
          conflictReason: mtMap.objectField(
            'conflict_reason',
            mtMap.passthrough()
          ),
          resolution: mtMap.objectField('resolution', mtMap.passthrough()),
          resolvedBy: mtMap.objectField(
            'resolved_by',
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
          resolvedAt: mtMap.objectField('resolved_at', mtMap.date()),
          appliedAt: mtMap.objectField('applied_at', mtMap.date()),
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

export type DashboardInstanceSkillsMergeRequestsItemsBulkResolveBody = {
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

export let mapDashboardInstanceSkillsMergeRequestsItemsBulkResolveBody =
  mtMap.object<DashboardInstanceSkillsMergeRequestsItemsBulkResolveBody>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          itemId: mtMap.objectField('item_id', mtMap.passthrough()),
          resolutionType: mtMap.objectField(
            'resolution_type',
            mtMap.passthrough()
          ),
          resolution: mtMap.objectField(
            'resolution',
            mtMap.object({
              title: mtMap.objectField('title', mtMap.passthrough()),
              content: mtMap.objectField('content', mtMap.passthrough()),
              fileId: mtMap.objectField('fileId', mtMap.passthrough())
            })
          )
        })
      )
    )
  });

