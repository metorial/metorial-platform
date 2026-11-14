import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceProtoGuardSuppressionsCreateOutput = {
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
};

export let mapDashboardInstanceProtoGuardSuppressionsCreateOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceProtoGuardSuppressionsCreateOutput>(
    [
      'provider_id',
      'tool_key',
      'content_hash',
      'expires_at',
      'archived_at',
      'created_at',
      'updated_at'
    ],
    1
  );

export type DashboardInstanceProtoGuardSuppressionsCreateBody = {
  filterId: string;
  providerId?: string | null | undefined;
  toolKey?: string | null | undefined;
  contentHash?: string | null | undefined;
  reason?: string | null | undefined;
  expiresAt?: Date | null | undefined;
};

export let mapDashboardInstanceProtoGuardSuppressionsCreateBody =
  /* @__PURE__ */ mapObject<DashboardInstanceProtoGuardSuppressionsCreateBody>(
    ['filter_id', 'provider_id', 'tool_key', 'content_hash', 'expires_at'],
    1
  );
