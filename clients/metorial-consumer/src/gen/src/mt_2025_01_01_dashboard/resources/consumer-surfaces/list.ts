import { mtMap } from '@metorial/util-resource-mapper';

export type ConsumerSurfacesListOutput = {
  items: {
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
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapConsumerSurfacesListOutput =
  mtMap.object<ConsumerSurfacesListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          status: mtMap.objectField('status', mtMap.passthrough()),
          name: mtMap.objectField('name', mtMap.passthrough()),
          description: mtMap.objectField('description', mtMap.passthrough()),
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

export type ConsumerSurfacesListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {};

export let mapConsumerSurfacesListQuery = mtMap.union([
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

