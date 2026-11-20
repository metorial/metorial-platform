import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceAgentTrackingIngestSourcesRevokeOutput = {
  object: 'agent_tracking.ingest_source';
  id: string;
  status: 'active' | 'revoked';
  name: string;
  clientFamily: string;
  secretRedacted: string;
  secret: string | null;
  ingestUrl: string | null;
  lastUsedAt: Date | null;
  lastUsedStatus: 'used' | 'never_used' | 'unknown';
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardInstanceAgentTrackingIngestSourcesRevokeOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceAgentTrackingIngestSourcesRevokeOutput>(
    [
      'client_family',
      'secret_redacted',
      'ingest_url',
      'last_used_at',
      'last_used_status',
      'revoked_at',
      'created_at',
      'updated_at'
    ],
    1
  );
