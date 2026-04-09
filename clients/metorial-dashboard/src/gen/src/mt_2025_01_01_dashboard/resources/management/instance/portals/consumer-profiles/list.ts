import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstancePortalsConsumerProfilesListOutput = {
  items: ({
    object: 'consumer.profile';
    id: string;
    name: string;
    email: string;
    imageUrl: string;
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
    consumerId: string;
    status: 'active' | 'invited';
    createdAt: Date;
    updatedAt: Date;
  } & {
    surface: {
      object: 'consumer.surface';
      id: string;
      status: 'active' | 'archived' | 'deleted';
      name: string;
      description: string | null;
      auth: {
        object: 'consumer.surface.auth';
        sessionExpiryTimeInSeconds: number;
        emailWhitelist: string[];
      };
      createdAt: Date;
      updatedAt: Date;
    };
  })[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapManagementInstancePortalsConsumerProfilesListOutput =
  mtMap.object<ManagementInstancePortalsConsumerProfilesListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.union([
          mtMap.unionOption(
            'object',
            mtMap.object({
              object: mtMap.objectField('object', mtMap.passthrough()),
              id: mtMap.objectField('id', mtMap.passthrough()),
              name: mtMap.objectField('name', mtMap.passthrough()),
              email: mtMap.objectField('email', mtMap.passthrough()),
              imageUrl: mtMap.objectField('image_url', mtMap.passthrough()),
              groups: mtMap.objectField(
                'groups',
                mtMap.array(
                  mtMap.object({
                    object: mtMap.objectField('object', mtMap.passthrough()),
                    group: mtMap.objectField(
                      'group',
                      mtMap.object({
                        object: mtMap.objectField(
                          'object',
                          mtMap.passthrough()
                        ),
                        id: mtMap.objectField('id', mtMap.passthrough()),
                        status: mtMap.objectField(
                          'status',
                          mtMap.passthrough()
                        ),
                        name: mtMap.objectField('name', mtMap.passthrough()),
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
                        updatedAt: mtMap.objectField('updated_at', mtMap.date())
                      })
                    ),
                    assignedVia: mtMap.objectField(
                      'assigned_via',
                      mtMap.passthrough()
                    )
                  })
                )
              ),
              consumerId: mtMap.objectField('consumer_id', mtMap.passthrough()),
              status: mtMap.objectField('status', mtMap.passthrough()),
              createdAt: mtMap.objectField('created_at', mtMap.date()),
              updatedAt: mtMap.objectField('updated_at', mtMap.date()),
              surface: mtMap.objectField(
                'surface',
                mtMap.object({
                  object: mtMap.objectField('object', mtMap.passthrough()),
                  id: mtMap.objectField('id', mtMap.passthrough()),
                  status: mtMap.objectField('status', mtMap.passthrough()),
                  name: mtMap.objectField('name', mtMap.passthrough()),
                  description: mtMap.objectField(
                    'description',
                    mtMap.passthrough()
                  ),
                  auth: mtMap.objectField(
                    'auth',
                    mtMap.object({
                      object: mtMap.objectField('object', mtMap.passthrough()),
                      sessionExpiryTimeInSeconds: mtMap.objectField(
                        'session_expiry_time_in_seconds',
                        mtMap.passthrough()
                      ),
                      emailWhitelist: mtMap.objectField(
                        'email_whitelist',
                        mtMap.array(mtMap.passthrough())
                      )
                    })
                  ),
                  createdAt: mtMap.objectField('created_at', mtMap.date()),
                  updatedAt: mtMap.objectField('updated_at', mtMap.date())
                })
              )
            })
          )
        ])
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

export type ManagementInstancePortalsConsumerProfilesListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  search?: string | undefined;
  consumerGroupId?: string | undefined;
  status?: 'active' | 'invited' | ('active' | 'invited')[] | undefined;
};

export let mapManagementInstancePortalsConsumerProfilesListQuery = mtMap.union([
  mtMap.unionOption(
    'object',
    mtMap.object({
      limit: mtMap.objectField('limit', mtMap.passthrough()),
      after: mtMap.objectField('after', mtMap.passthrough()),
      before: mtMap.objectField('before', mtMap.passthrough()),
      cursor: mtMap.objectField('cursor', mtMap.passthrough()),
      order: mtMap.objectField('order', mtMap.passthrough()),
      search: mtMap.objectField('search', mtMap.passthrough()),
      consumerGroupId: mtMap.objectField(
        'consumer_group_id',
        mtMap.passthrough()
      ),
      status: mtMap.objectField(
        'status',
        mtMap.union([mtMap.unionOption('array', mtMap.union([]))])
      )
    })
  )
]);

