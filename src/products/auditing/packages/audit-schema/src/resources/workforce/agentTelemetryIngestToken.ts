import { v } from '@lowerdeck/validation';
import type {
  AgentTelemetryIngestTokenDeviceMode,
  AgentTelemetryIngestTokenStatus
} from '@metorial/db';
import { resource } from '../../_lib/resource';

export let agentTelemetryIngestTokenAuditResource = resource({
  name: 'agent_telemetry_ingest_token',
  payload: v.typedAny<{
    id: string;
    groundstationIngestTokenId: string;
    name: string;
    status: AgentTelemetryIngestTokenStatus;
    deviceMode: AgentTelemetryIngestTokenDeviceMode;
    consumerId: string;
    consumerDeviceId: string | null;
    replacedIngestTokenIds: string[];
  }>('agent_telemetry_ingest_token'),
  presenter: undefined,
  actions: {
    create: true,
    rotate: true
  }
});
