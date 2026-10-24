import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceProtoGuardSuppressionsListOutput = {
  items: {
    object: 'protoguard.suppression';
    id: string;
    status: 'active' | 'archived';
    reason: string | null;
    filter: {
      object: 'protoguard.filter#preview';
      id: string;
      key: string;
      name: string;
    };
    providerId: string | null;
    toolKey: string | null;
    contentHash: string | null;
    expiresAt: Date | null;
    archivedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardInstanceProtoGuardSuppressionsListOutput =
  /* @__PURE__ */ createMapper<DashboardInstanceProtoGuardSuppressionsListOutput>(
    [
      7,
      [
        1,
        [
          'provider_id',
          'tool_key',
          'content_hash',
          'expires_at',
          'archived_at',
          'created_at',
          'updated_at'
        ]
      ]
    ],
    1
  );

export type DashboardInstanceProtoGuardSuppressionsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  status?: 'active' | 'archived' | ('active' | 'archived')[] | undefined;
  filterId?: string | string[] | undefined;
  providerId?: string | string[] | undefined;
};

export let mapDashboardInstanceProtoGuardSuppressionsListQuery =
  /* @__PURE__ */ createMapper<DashboardInstanceProtoGuardSuppressionsListQuery>(
    [3, [[0, [1, ['filter_id', 'provider_id']]]]]
  );
