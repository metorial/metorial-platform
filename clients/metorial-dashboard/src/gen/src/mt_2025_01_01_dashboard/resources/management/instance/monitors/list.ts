import { createMapper } from '@metorial/util-resource-mapper/compact';

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
  /* @__PURE__ */ createMapper<ManagementInstanceMonitorsListOutput>(
    [
      7,
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
    1
  );

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

export let mapManagementInstanceMonitorsListQuery =
  /* @__PURE__ */ createMapper<ManagementInstanceMonitorsListQuery>([
    3,
    [
      [
        0,
        [
          1,
          [
            'provider_id',
            'proto_guard_filter_id',
            ['created_at', 1, 5],
            ['updated_at', 1, 5],
            ['first_alert_at', 1, 5],
            ['last_alert_at', 1, 5]
          ]
        ]
      ]
    ]
  ]);
