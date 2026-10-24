import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ProtoGuardSuppressionsListOutput = {
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

export let mapProtoGuardSuppressionsListOutput =
  /* @__PURE__ */ createMapper<ProtoGuardSuppressionsListOutput>(
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

export type ProtoGuardSuppressionsListQuery = {
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

export let mapProtoGuardSuppressionsListQuery =
  /* @__PURE__ */ createMapper<ProtoGuardSuppressionsListQuery>([
    3,
    [[0, [1, ['filter_id', 'provider_id']]]]
  ]);
