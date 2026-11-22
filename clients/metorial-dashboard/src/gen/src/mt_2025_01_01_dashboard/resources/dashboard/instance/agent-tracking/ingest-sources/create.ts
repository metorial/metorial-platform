import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceAgentTrackingIngestSourcesCreateOutput = {
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

export let mapDashboardInstanceAgentTrackingIngestSourcesCreateOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceAgentTrackingIngestSourcesCreateOutput>(
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

export type DashboardInstanceAgentTrackingIngestSourcesCreateBody = {
  name: string;
  clientFamily: 'claude_code';
};

export let mapDashboardInstanceAgentTrackingIngestSourcesCreateBody =
  /* @__PURE__ */ mapObject<DashboardInstanceAgentTrackingIngestSourcesCreateBody>(
    ['client_family']
  );
