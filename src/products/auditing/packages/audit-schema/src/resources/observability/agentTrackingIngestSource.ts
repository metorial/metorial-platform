import { v } from '@lowerdeck/validation';
import type { AgentTrackingIngestSourceStatus } from '@metorial/db';
import { resource } from '../../_lib/resource';

export let agentTrackingIngestSourceAuditResource = resource({
  name: 'agent_tracking_ingest_source',
  payload: v.typedAny<{
    id: string;
    name: string;
    status: AgentTrackingIngestSourceStatus;
    clientFamily: string;
    instanceId: string;
    revokedAt: Date | null;
  }>('agent_tracking_ingest_source'),
  presenter: undefined,
  actions: {
    create: true,
    revoke: true
  }
});
