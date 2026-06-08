import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceMonitorAlertsListOutput = {
  items: {
    object: 'monitor.alert';
    id: string;
    status: 'pending' | 'resolved' | 'ignored';
    monitor: {
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
    };
    protoGuardAlertId: string | null;
    protoGuardRunId: string | null;
    specificationChangeNotification: {
      object: 'provider.specification_change_notification';
      id: string;
      providerId: string;
      providerVersionId: string;
      fromSpecification: {
        object: 'provider.capabilities.specification#preview';
        id: string;
        name: string;
        description: string | null;
        createdAt: Date;
        updatedAt: Date;
      } | null;
      toSpecification: {
        object: 'provider.capabilities.specification#preview';
        id: string;
        name: string;
        description: string | null;
        createdAt: Date;
        updatedAt: Date;
      } | null;
      fromProviderVersion: {
        object: 'provider.version#preview';
        id: string;
        version: string;
        name: string;
        description: string | null;
        createdAt: Date;
        updatedAt: Date;
      } | null;
      toProviderVersion: {
        object: 'provider.version#preview';
        id: string;
        version: string;
        name: string;
        description: string | null;
        createdAt: Date;
        updatedAt: Date;
      } | null;
      createdAt: Date;
    } | null;
    createdAt: Date;
    resolvedAt: Date | null;
    recipients: {
      object: 'monitor.alert_recipient';
      id: string;
      recipientId: string;
      viewedAt: Date | null;
      createdAt: Date;
    }[];
    events: {
      object: 'monitor.alert_event';
      id: string;
      type: 'created' | 'viewed' | 'resolved' | 'unresolved';
      actorId: string | null;
      createdAt: Date;
    }[];
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapManagementInstanceMonitorAlertsListOutput =
  mtMap.object<ManagementInstanceMonitorAlertsListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          status: mtMap.objectField('status', mtMap.passthrough()),
          monitor: mtMap.objectField(
            'monitor',
            mtMap.object({
              object: mtMap.objectField('object', mtMap.passthrough()),
              id: mtMap.objectField('id', mtMap.passthrough()),
              name: mtMap.objectField('name', mtMap.passthrough()),
              description: mtMap.objectField(
                'description',
                mtMap.passthrough()
              ),
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
          ),
          protoGuardAlertId: mtMap.objectField(
            'proto_guard_alert_id',
            mtMap.passthrough()
          ),
          protoGuardRunId: mtMap.objectField(
            'proto_guard_run_id',
            mtMap.passthrough()
          ),
          specificationChangeNotification: mtMap.objectField(
            'specification_change_notification',
            mtMap.object({
              object: mtMap.objectField('object', mtMap.passthrough()),
              id: mtMap.objectField('id', mtMap.passthrough()),
              providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
              providerVersionId: mtMap.objectField(
                'provider_version_id',
                mtMap.passthrough()
              ),
              fromSpecification: mtMap.objectField(
                'from_specification',
                mtMap.object({
                  object: mtMap.objectField('object', mtMap.passthrough()),
                  id: mtMap.objectField('id', mtMap.passthrough()),
                  name: mtMap.objectField('name', mtMap.passthrough()),
                  description: mtMap.objectField(
                    'description',
                    mtMap.passthrough()
                  ),
                  createdAt: mtMap.objectField('created_at', mtMap.date()),
                  updatedAt: mtMap.objectField('updated_at', mtMap.date())
                })
              ),
              toSpecification: mtMap.objectField(
                'to_specification',
                mtMap.object({
                  object: mtMap.objectField('object', mtMap.passthrough()),
                  id: mtMap.objectField('id', mtMap.passthrough()),
                  name: mtMap.objectField('name', mtMap.passthrough()),
                  description: mtMap.objectField(
                    'description',
                    mtMap.passthrough()
                  ),
                  createdAt: mtMap.objectField('created_at', mtMap.date()),
                  updatedAt: mtMap.objectField('updated_at', mtMap.date())
                })
              ),
              fromProviderVersion: mtMap.objectField(
                'from_provider_version',
                mtMap.object({
                  object: mtMap.objectField('object', mtMap.passthrough()),
                  id: mtMap.objectField('id', mtMap.passthrough()),
                  version: mtMap.objectField('version', mtMap.passthrough()),
                  name: mtMap.objectField('name', mtMap.passthrough()),
                  description: mtMap.objectField(
                    'description',
                    mtMap.passthrough()
                  ),
                  createdAt: mtMap.objectField('created_at', mtMap.date()),
                  updatedAt: mtMap.objectField('updated_at', mtMap.date())
                })
              ),
              toProviderVersion: mtMap.objectField(
                'to_provider_version',
                mtMap.object({
                  object: mtMap.objectField('object', mtMap.passthrough()),
                  id: mtMap.objectField('id', mtMap.passthrough()),
                  version: mtMap.objectField('version', mtMap.passthrough()),
                  name: mtMap.objectField('name', mtMap.passthrough()),
                  description: mtMap.objectField(
                    'description',
                    mtMap.passthrough()
                  ),
                  createdAt: mtMap.objectField('created_at', mtMap.date()),
                  updatedAt: mtMap.objectField('updated_at', mtMap.date())
                })
              ),
              createdAt: mtMap.objectField('created_at', mtMap.date())
            })
          ),
          createdAt: mtMap.objectField('created_at', mtMap.date()),
          resolvedAt: mtMap.objectField('resolved_at', mtMap.date()),
          recipients: mtMap.objectField(
            'recipients',
            mtMap.array(
              mtMap.object({
                object: mtMap.objectField('object', mtMap.passthrough()),
                id: mtMap.objectField('id', mtMap.passthrough()),
                recipientId: mtMap.objectField(
                  'recipient_id',
                  mtMap.passthrough()
                ),
                viewedAt: mtMap.objectField('viewed_at', mtMap.date()),
                createdAt: mtMap.objectField('created_at', mtMap.date())
              })
            )
          ),
          events: mtMap.objectField(
            'events',
            mtMap.array(
              mtMap.object({
                object: mtMap.objectField('object', mtMap.passthrough()),
                id: mtMap.objectField('id', mtMap.passthrough()),
                type: mtMap.objectField('type', mtMap.passthrough()),
                actorId: mtMap.objectField('actor_id', mtMap.passthrough()),
                createdAt: mtMap.objectField('created_at', mtMap.date())
              })
            )
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

export type ManagementInstanceMonitorAlertsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  id?: string | string[] | undefined;
  monitorId?: string | string[] | undefined;
  status?:
    | 'pending'
    | 'resolved'
    | 'ignored'
    | ('pending' | 'resolved' | 'ignored')[]
    | undefined;
  target?:
    | 'protoguard_filter'
    | 'schema_change'
    | ('protoguard_filter' | 'schema_change')[]
    | undefined;
  source?:
    | 'protoguard'
    | 'specification_change'
    | ('protoguard' | 'specification_change')[]
    | undefined;
  providerId?: string | string[] | undefined;
  protoGuardAlertId?: string | string[] | undefined;
  protoGuardRunId?: string | string[] | undefined;
  protoGuardFilterId?: string | string[] | undefined;
  specificationChangeNotificationId?: string | string[] | undefined;
  sessionId?: string | string[] | undefined;
  sessionMessageId?: string | string[] | undefined;
  sessionConnectionId?: string | string[] | undefined;
  providerRunId?: string | string[] | undefined;
  createdAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
  resolvedAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
};

export let mapManagementInstanceMonitorAlertsListQuery = mtMap.union([
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
      monitorId: mtMap.objectField(
        'monitor_id',
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
      target: mtMap.objectField(
        'target',
        mtMap.union([mtMap.unionOption('array', mtMap.union([]))])
      ),
      source: mtMap.objectField(
        'source',
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
      protoGuardAlertId: mtMap.objectField(
        'proto_guard_alert_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      protoGuardRunId: mtMap.objectField(
        'proto_guard_run_id',
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
      specificationChangeNotificationId: mtMap.objectField(
        'specification_change_notification_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      sessionId: mtMap.objectField(
        'session_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      sessionMessageId: mtMap.objectField(
        'session_message_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      sessionConnectionId: mtMap.objectField(
        'session_connection_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      providerRunId: mtMap.objectField(
        'provider_run_id',
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
      ),
      resolvedAt: mtMap.objectField(
        'resolved_at',
        mtMap.object({
          gt: mtMap.objectField('gt', mtMap.date()),
          lt: mtMap.objectField('lt', mtMap.date())
        })
      )
    })
  )
]);

