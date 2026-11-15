import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ProtoGuardSuppressionsCreateOutput = {
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

export let mapProtoGuardSuppressionsCreateOutput =
  /* @__PURE__ */ mapObject<ProtoGuardSuppressionsCreateOutput>(
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

export type ProtoGuardSuppressionsCreateBody = {
  filterId: string;
  providerId?: string | null | undefined;
  toolKey?: string | null | undefined;
  contentHash?: string | null | undefined;
  reason?: string | null | undefined;
  expiresAt?: Date | null | undefined;
};

export let mapProtoGuardSuppressionsCreateBody =
  /* @__PURE__ */ mapObject<ProtoGuardSuppressionsCreateBody>(
    ['filter_id', 'provider_id', 'tool_key', 'content_hash', 'expires_at'],
    1
  );
