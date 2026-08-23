import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceStoresParticipantsListOutput = {
  items: {
    object: 'store.participant';
    id: string;
    storeId: string;
    permissions: ('content_read' | 'content_write')[];
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
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardInstanceStoresParticipantsListOutput =
  mtMap.object<DashboardInstanceStoresParticipantsListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          storeId: mtMap.objectField('store_id', mtMap.passthrough()),
          permissions: mtMap.objectField(
            'permissions',
            mtMap.array(mtMap.passthrough())
          ),
          actor: mtMap.objectField(
            'actor',
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
          createdAt: mtMap.objectField('created_at', mtMap.date())
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

export type DashboardInstanceStoresParticipantsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {};

export let mapDashboardInstanceStoresParticipantsListQuery = mtMap.union([
  mtMap.unionOption(
    'object',
    mtMap.object({
      limit: mtMap.objectField('limit', mtMap.passthrough()),
      after: mtMap.objectField('after', mtMap.passthrough()),
      before: mtMap.objectField('before', mtMap.passthrough()),
      cursor: mtMap.objectField('cursor', mtMap.passthrough()),
      order: mtMap.objectField('order', mtMap.passthrough())
    })
  )
]);

