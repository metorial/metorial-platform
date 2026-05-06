import type {
  Agent,
  AgentClient,
  AgentClientRegistration,
  AgentInstance,
  IdentityActor,
  Provider,
  SessionParticipant
} from '@metorial-subspace/db';

export type SessionParticipantPresenterProps = SessionParticipant & {
    provider: Provider | null;
    agentInstance:
      | (AgentInstance & {
          agent: Agent & {
            actor: IdentityActor;
          };
          agentClient: AgentClient | null;
          agentClientRegistration: AgentClientRegistration | null;
        })
      | null;
  };

export let sessionParticipantPresenter = (participant: SessionParticipantPresenterProps) => ({
  object: 'session.participant',

  id: participant.id,
  type:
    participant.type === 'legacy_mcp_client' ||
    participant.type === 'legacy_metorial_protocol_client' ||
    participant.type === 'legacy_tool_call'
      ? 'agent'
      : participant.type,

  identifier: participant.identifier,
  name: participant.name,
  data: participant.payload,

  providerId: participant.provider?.id,
  connectionType: participant.connectionType ?? null,
  agentId: participant.agentInstance?.agent.id ?? null,
  agentInstanceId: participant.agentInstance?.id ?? null,
  identityActorId: participant.agentInstance?.agent.actor.id ?? null,
  agentClientId: participant.agentInstance?.agentClient?.id ?? null,

  createdAt: participant.createdAt
});
