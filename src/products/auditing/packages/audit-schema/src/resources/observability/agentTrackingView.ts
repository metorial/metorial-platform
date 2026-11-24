import { v } from '@lowerdeck/validation';
import type { AgentTrackingViewStatus } from '@metorial/db';
import { resource } from '../../_lib/resource';

export let agentTrackingViewAuditResource = resource({
  name: 'agent_tracking_view',
  payload: v.typedAny<{
    id: string;
    name: string;
    status: AgentTrackingViewStatus;
    page: string;
    kind: string;
    params: PrismaJson.AgentTrackingViewParams;
    instanceId: string;
    creatorActorId: string | null;
    deletedAt: Date | null;
  }>('agent_tracking_view'),
  presenter: undefined,
  actions: {
    create: true,
    update: true,
    delete: true
  }
});
