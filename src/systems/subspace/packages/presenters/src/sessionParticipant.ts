import type { Provider, SessionParticipant } from '@metorial-subspace/db';

export let sessionParticipantPresenter = (
  participant: SessionParticipant & {
    provider: Provider | null;
  }
) => ({
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

  createdAt: participant.createdAt
});
