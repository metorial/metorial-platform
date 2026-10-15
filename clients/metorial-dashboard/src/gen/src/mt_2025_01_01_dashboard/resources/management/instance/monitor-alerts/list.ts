import { createMapper } from '@metorial/util-resource-mapper/compact';

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
  /* @__PURE__ */ createMapper<ManagementInstanceMonitorAlertsListOutput>(
    [
      7,
      [
        1,
        [
          [
            'monitor',
            0,
            [
              1,
              [
                'proto_guard_filter_id',
                'provider_id',
                'created_at',
                'updated_at',
                'first_alert_at',
                'last_alert_at'
              ]
            ]
          ],
          'proto_guard_alert_id',
          'proto_guard_run_id',
          [
            'specification_change_notification',
            1,
            [
              1,
              [
                'provider_id',
                'provider_version_id',
                ['from_specification', 1, 8],
                ['to_specification', 1, 8],
                ['from_provider_version', 1, 8],
                ['to_provider_version', 1, 8],
                'created_at'
              ]
            ]
          ],
          'created_at',
          'resolved_at',
          [
            'recipients',
            0,
            [2, [1, ['recipient_id', 'viewed_at', 'created_at']]]
          ],
          ['events', 0, [2, [1, ['actor_id', 'created_at']]]]
        ]
      ]
    ],
    1
  );

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

export let mapManagementInstanceMonitorAlertsListQuery =
  /* @__PURE__ */ createMapper<ManagementInstanceMonitorAlertsListQuery>([
    3,
    [
      [
        0,
        [
          1,
          [
            'monitor_id',
            'provider_id',
            'proto_guard_alert_id',
            'proto_guard_run_id',
            'proto_guard_filter_id',
            'specification_change_notification_id',
            'session_id',
            'session_message_id',
            'session_connection_id',
            'provider_run_id',
            ['created_at', 1, 5],
            ['resolved_at', 1, 5]
          ]
        ]
      ]
    ]
  ]);
