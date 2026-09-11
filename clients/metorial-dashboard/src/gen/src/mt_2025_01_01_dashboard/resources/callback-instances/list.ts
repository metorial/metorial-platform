import { mtMap } from '@metorial/util-resource-mapper';

export type CallbackInstancesListOutput = {
  items: {
    object: 'callback.instance';
    id: string;
    status: 'active' | 'archived' | 'deleted';
    callbackId: string;
    integrationInstanceId: string;
    integrationInstanceProviderId: string;
    createdAt: Date;
    updatedAt: Date;
    sync: {
      object: 'callback.sync';
      status: 'pending' | 'synced' | 'failed';
      error: {
        object: 'callback.sync.error';
        code: string;
        message: string | null;
      } | null;
      syncedAt: Date | null;
    };
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapCallbackInstancesListOutput =
  mtMap.object<CallbackInstancesListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          status: mtMap.objectField('status', mtMap.passthrough()),
          callbackId: mtMap.objectField('callback_id', mtMap.passthrough()),
          integrationInstanceId: mtMap.objectField(
            'integration_instance_id',
            mtMap.passthrough()
          ),
          integrationInstanceProviderId: mtMap.objectField(
            'integration_instance_provider_id',
            mtMap.passthrough()
          ),
          createdAt: mtMap.objectField('created_at', mtMap.date()),
          updatedAt: mtMap.objectField('updated_at', mtMap.date()),
          sync: mtMap.objectField(
            'sync',
            mtMap.object({
              object: mtMap.objectField('object', mtMap.passthrough()),
              status: mtMap.objectField('status', mtMap.passthrough()),
              error: mtMap.objectField(
                'error',
                mtMap.object({
                  object: mtMap.objectField('object', mtMap.passthrough()),
                  code: mtMap.objectField('code', mtMap.passthrough()),
                  message: mtMap.objectField('message', mtMap.passthrough())
                })
              ),
              syncedAt: mtMap.objectField('synced_at', mtMap.date())
            })
          )
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

export type CallbackInstancesListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  id?: string | string[] | undefined;
  callbackId?: string | string[] | undefined;
  integrationId?: string | string[] | undefined;
  integrationInstanceId?: string | string[] | undefined;
  integrationInstanceProviderId?: string | string[] | undefined;
  status?:
    | 'active'
    | 'archived'
    | 'deleted'
    | ('active' | 'archived' | 'deleted')[]
    | undefined;
  createdAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
  updatedAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
};

export let mapCallbackInstancesListQuery = mtMap.union([
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
      callbackId: mtMap.objectField(
        'callback_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      integrationId: mtMap.objectField(
        'integration_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      integrationInstanceId: mtMap.objectField(
        'integration_instance_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      integrationInstanceProviderId: mtMap.objectField(
        'integration_instance_provider_id',
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
      createdAt: mtMap.objectField(
        'created_at',
        mtMap.object({
          gt: mtMap.objectField('gt', mtMap.date()),
          lt: mtMap.objectField('lt', mtMap.date())
        })
      ),
      updatedAt: mtMap.objectField(
        'updated_at',
        mtMap.object({
          gt: mtMap.objectField('gt', mtMap.date()),
          lt: mtMap.objectField('lt', mtMap.date())
        })
      )
    })
  )
]);

