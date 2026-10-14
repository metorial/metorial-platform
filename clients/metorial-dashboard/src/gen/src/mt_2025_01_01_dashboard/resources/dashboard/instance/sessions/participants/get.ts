import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceSessionsParticipantsGetOutput = {
  object: 'session.participant';
  id: string;
  type: 'unknown' | 'provider' | 'agent' | 'system';
  identifier: string;
  name: string;
  data: { identifier: string; name: string };
  providerId: string | null;
  connectionType: 'mcp' | 'metorial_protocol' | 'tool_call' | null;
  agentId: string | null;
  agentInstanceId: string | null;
  identityActorId: string | null;
  identityId: string | null;
  agentActorId: string | null;
  agentClientId: string | null;
  consumerId: string | null;
  createdAt: Date;
};

export let mapDashboardInstanceSessionsParticipantsGetOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceSessionsParticipantsGetOutput>(
    [
      'provider_id',
      'connection_type',
      'agent_id',
      'agent_instance_id',
      'identity_actor_id',
      'identity_id',
      'agent_actor_id',
      'agent_client_id',
      'consumer_id',
      'created_at'
    ],
    1
  );
