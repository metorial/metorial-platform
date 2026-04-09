import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceConsumersListOutput = {
  items: ({
    object: 'consumer';
    id: string;
    name: string;
    email: string;
    createdAt: Date;
    updatedAt: Date;
  } & { isPortalConsumer: boolean; isOrganizationMember: boolean })[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapManagementInstanceConsumersListOutput =
  mtMap.object<ManagementInstanceConsumersListOutput>({
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
              createdAt: mtMap.objectField('created_at', mtMap.date()),
              updatedAt: mtMap.objectField('updated_at', mtMap.date()),
              isPortalConsumer: mtMap.objectField(
                'is_portal_consumer',
                mtMap.passthrough()
              ),
              isOrganizationMember: mtMap.objectField(
                'is_organization_member',
                mtMap.passthrough()
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

export type ManagementInstanceConsumersListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & { search?: string | undefined; id?: string | undefined };

export let mapManagementInstanceConsumersListQuery = mtMap.union([
  mtMap.unionOption(
    'object',
    mtMap.object({
      limit: mtMap.objectField('limit', mtMap.passthrough()),
      after: mtMap.objectField('after', mtMap.passthrough()),
      before: mtMap.objectField('before', mtMap.passthrough()),
      cursor: mtMap.objectField('cursor', mtMap.passthrough()),
      order: mtMap.objectField('order', mtMap.passthrough()),
      search: mtMap.objectField('search', mtMap.passthrough()),
      id: mtMap.objectField('id', mtMap.passthrough())
    })
  )
]);

