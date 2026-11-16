import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceProtoGuardSuppressionsArchiveOutput = {
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

export let mapManagementInstanceProtoGuardSuppressionsArchiveOutput =
  /* @__PURE__ */ mapObject<ManagementInstanceProtoGuardSuppressionsArchiveOutput>(
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
