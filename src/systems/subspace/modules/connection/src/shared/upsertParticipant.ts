import { canonicalize } from '@lowerdeck/canonicalize';
import { Hash } from '@lowerdeck/hash';
import {
  db,
  getId,
  type Provider,
  type Session,
  type SessionParticipantType
} from '@metorial-subspace/db';

export let upsertParticipant = async (d: {
  session: Session;
  from:
    | {
        type: 'connection_client';
        transport: 'mcp' | 'metorial';
        participant: PrismaJson.SessionParticipantPayload;
      }
    | {
        type: 'provider';
        provider: Provider;
      }
    | {
        type: 'tool_call';
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

  switch (d.from.type) {
    case 'connection_client':
      participantData = d.from.participant;
      hash = await Hash.sha256(canonicalize([d.session.tenantOid, participantData]));
      type = d.from.transport === 'mcp' ? 'mcp_client' : 'metorial_protocol_client';
      break;

    case 'provider':
      participantData = {
        identifier: `provider:${d.from.provider.id}`,
        name: d.from.provider.name
      };
      hash = `provider:${d.from.provider.id}`;
      type = 'provider';
      break;

    case 'tool_call':
      participantData = {
        identifier: 'tool_call',
        name: 'Tool Call'
      };
      type = 'tool_call';
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
      payload: participantData,
      tenantOid: d.session.tenantOid,
      environmentOid: d.session.environmentOid,
      providerOid: d.from.type === 'provider' ? d.from.provider.oid : undefined
    },
    update: {}
  });
};
