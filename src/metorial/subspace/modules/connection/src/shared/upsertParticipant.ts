import { canonicalize } from '@lowerdeck/canonicalize';
import { Hash } from '@lowerdeck/hash';
import {
  type AgentInstance,
  db,
  getId,
  SessionParticipantConnectionType,
  type Provider,
  type Session,
  type SessionParticipantType
} from '@metorial-subspace/db';

export let upsertParticipant = async (d: {
  session: Session;
  from:
    | {
        type: 'connection_client';
        transport: SessionParticipantConnectionType;
        participant: PrismaJson.SessionParticipantPayload;
        agentInstance?: AgentInstance | null;
      }
    | {
        type: 'provider';
        provider: Provider;
      }
    | {
        type: 'system';
      }
    | {
        type: 'unknown';
      };
}) => {
  let hash: string = d.from.type;
  let participantData: PrismaJson.SessionParticipantPayload;
  let type: SessionParticipantType;
  let connectionType: SessionParticipantConnectionType | undefined;

  switch (d.from.type) {
    case 'connection_client':
      participantData = d.from.participant;
      hash = await Hash.sha256(canonicalize([d.session.tenantOid, participantData]));
      connectionType = d.from.transport;
      type = 'agent';
      break;

    case 'provider':
      participantData = {
        identifier: `provider:${d.from.provider.id}`,
        name: d.from.provider.name
      };
      hash = `provider:${d.from.provider.id}`;
      type = 'provider';
      break;

    case 'system':
      participantData = {
        identifier: 'system',
        name: 'System'
      };
      type = 'system';
      break;

    case 'unknown':
      participantData = {
        identifier: 'unknown',
        name: 'Unknown'
      };
      type = 'unknown';
      break;
  }

  return await db.sessionParticipant.upsert({
    where: {
      tenantOid_type_hash: {
        tenantOid: d.session.tenantOid,
        type: type,
        hash: hash
      }
    },
    create: {
      ...getId('sessionParticipant'),
      hash,
      type,
      identifier: participantData.identifier,
      name: participantData.name,
      connectionType,
      payload: participantData,
      tenantOid: d.session.tenantOid,
      projectOid: d.session.projectOid,
      environmentOid: d.session.environmentOid,
      instanceOid: d.session.instanceOid,
      providerOid: d.from.type === 'provider' ? d.from.provider.oid : undefined,
      agentInstanceOid:
        d.from.type === 'connection_client' ? d.from.agentInstance?.oid : undefined,
      identityActorOid:
        d.from.type === 'connection_client' ? (d.session.identityActorOid ?? null) : undefined,
      identityOid:
        d.from.type === 'connection_client' ? (d.session.identityOid ?? null) : undefined
    },
    update:
      d.from.type === 'connection_client'
        ? {
            identifier: participantData.identifier,
            name: participantData.name,
            payload: participantData,
            connectionType,
            agentInstanceOid: d.from.agentInstance?.oid,
            identityActorOid: d.session.identityActorOid ?? null,
            identityOid: d.session.identityOid ?? null
          }
        : {}
  });
};
