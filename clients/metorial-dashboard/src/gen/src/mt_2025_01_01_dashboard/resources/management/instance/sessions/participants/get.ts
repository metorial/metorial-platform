import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceSessionsParticipantsGetOutput = {
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
  agentClientId: string | null;
  consumerId: string | null;
  createdAt: Date;
};

export let mapManagementInstanceSessionsParticipantsGetOutput =
  mtMap.object<ManagementInstanceSessionsParticipantsGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    type: mtMap.objectField('type', mtMap.passthrough()),
    identifier: mtMap.objectField('identifier', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    data: mtMap.objectField(
      'data',
      mtMap.object({
        identifier: mtMap.objectField('identifier', mtMap.passthrough()),
        name: mtMap.objectField('name', mtMap.passthrough())
      })
    ),
    providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
    connectionType: mtMap.objectField('connection_type', mtMap.passthrough()),
    agentId: mtMap.objectField('agent_id', mtMap.passthrough()),
    agentInstanceId: mtMap.objectField(
      'agent_instance_id',
      mtMap.passthrough()
    ),
    identityActorId: mtMap.objectField(
      'identity_actor_id',
      mtMap.passthrough()
    ),
    agentClientId: mtMap.objectField('agent_client_id', mtMap.passthrough()),
    consumerId: mtMap.objectField('consumer_id', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date())
  });

