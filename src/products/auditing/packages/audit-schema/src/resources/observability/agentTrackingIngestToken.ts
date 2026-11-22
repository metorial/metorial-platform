import { v } from '@lowerdeck/validation';
import type {
  AgentTrackingIngestTokenDeviceMode,
  AgentTrackingIngestTokenStatus
} from '@metorial/db';
import { resource } from '../../_lib/resource';

export let agentTrackingIngestTokenAuditResource = resource({
  name: 'agent_tracking_ingest_token',
  payload: v.typedAny<{
    id: string;
    serviceIngestTokenId: string;
    name: string;
    status: AgentTrackingIngestTokenStatus;
    deviceMode: AgentTrackingIngestTokenDeviceMode;
    consumerId: string;
    consumerDeviceId: string | null;
    replacedIngestTokenIds: string[];
  }>('agent_tracking_ingest_token'),
  presenter: undefined,
  actions: {
    create: true,
    rotate: true
  }
});
