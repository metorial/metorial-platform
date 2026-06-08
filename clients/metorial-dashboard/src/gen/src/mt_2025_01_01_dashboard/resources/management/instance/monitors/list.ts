import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceMonitorsListOutput = {
  items: {
    object: 'monitor';
    id: string;
    name: string;
    description: string | null;
    target: 'protoguard_filter' | 'schema_change';
    status: 'active' | 'inactive';
    owner: 'organization' | 'system';
    protoGuardFilterId: string | null;
    providerId: string | null;
    createdAt: Date;
    updatedAt: Date;
    firstAlertAt: Date | null;
    lastAlertAt: Date | null;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapManagementInstanceMonitorsListOutput =
  mtMap.object<ManagementInstanceMonitorsListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          name: mtMap.objectField('name', mtMap.passthrough()),
          description: mtMap.objectField('description', mtMap.passthrough()),
          target: mtMap.objectField('target', mtMap.passthrough()),
          status: mtMap.objectField('status', mtMap.passthrough()),
          owner: mtMap.objectField('owner', mtMap.passthrough()),
          protoGuardFilterId: mtMap.objectField(
            'proto_guard_filter_id',
            mtMap.passthrough()
          ),
          providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
          createdAt: mtMap.objectField('created_at', mtMap.date()),
          updatedAt: mtMap.objectField('updated_at', mtMap.date()),
          firstAlertAt: mtMap.objectField('first_alert_at', mtMap.date()),
          lastAlertAt: mtMap.objectField('last_alert_at', mtMap.date())
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

export type ManagementInstanceMonitorsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  id?: string | string[] | undefined;
  target?:
    | 'protoguard_filter'
    | 'schema_change'
    | ('protoguard_filter' | 'schema_change')[]
    | undefined;
  status?: 'active' | 'inactive' | ('active' | 'inactive')[] | undefined;
  providerId?: string | string[] | undefined;
  protoGuardFilterId?: string | string[] | undefined;
  search?: string | undefined;
  createdAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
  updatedAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
  firstAlertAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
  lastAlertAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
};

export let mapManagementInstanceMonitorsListQuery = mtMap.union([
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
      target: mtMap.objectField(
        'target',
        mtMap.union([mtMap.unionOption('array', mtMap.union([]))])
      ),
      status: mtMap.objectField(
        'status',
        mtMap.union([mtMap.unionOption('array', mtMap.union([]))])
      ),
      providerId: mtMap.objectField(
        'provider_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      protoGuardFilterId: mtMap.objectField(
        'proto_guard_filter_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      search: mtMap.objectField('search', mtMap.passthrough()),
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
      ),
      firstAlertAt: mtMap.objectField(
        'first_alert_at',
        mtMap.object({
          gt: mtMap.objectField('gt', mtMap.date()),
          lt: mtMap.objectField('lt', mtMap.date())
        })
      ),
      lastAlertAt: mtMap.objectField(
        'last_alert_at',
        mtMap.object({
          gt: mtMap.objectField('gt', mtMap.date()),
          lt: mtMap.objectField('lt', mtMap.date())
        })
      )
    })
  )
]);

