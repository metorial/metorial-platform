import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceAgentTrackingIngestSourcesListOutput = {
  items: {
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
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardInstanceAgentTrackingIngestSourcesListOutput =
  /* @__PURE__ */ createMapper<DashboardInstanceAgentTrackingIngestSourcesListOutput>(
    [
      7,
      [
        1,
        [
          'client_family',
          'secret_redacted',
          'ingest_url',
          'last_used_at',
          'last_used_status',
          'revoked_at',
          'created_at',
          'updated_at'
        ]
      ]
    ],
    1
  );

export type DashboardInstanceAgentTrackingIngestSourcesListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & { status?: 'active' | 'revoked' | ('active' | 'revoked')[] | undefined };

export let mapDashboardInstanceAgentTrackingIngestSourcesListQuery =
  /* @__PURE__ */ createMapper<DashboardInstanceAgentTrackingIngestSourcesListQuery>(0);
