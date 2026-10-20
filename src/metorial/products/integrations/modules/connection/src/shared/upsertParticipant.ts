import { createLocallyCachedFunction } from '@lowerdeck/cache';
import { canonicalize } from '@lowerdeck/canonicalize';
import { Hash } from '@lowerdeck/hash';
import {
  type AgentInstance,
  db,
  getId,
  Prisma,
  SessionParticipantConnectionType,
  type Provider,
  type Session,
  type SessionParticipantType
} from '@metorial-subspace/db';
import { withUniqueConstraintRecovery } from '@metorial/db';
import { isDeepStrictEqual } from 'node:util';

let participantInclude = {
  identity: { select: { id: true } },
  identityActor: { select: { id: true } }
} satisfies Prisma.SessionParticipantInclude;

type ParticipantWithIdentity = Prisma.SessionParticipantGetPayload<{
  include: typeof participantInclude;
}>;

// Provider, system and unknown participants are never updated after creation, so the row for
// a given tenant/type/hash can be reused for the life of the process.
let getStaticParticipant = createLocallyCachedFunction({
  getHash: (d: {
    tenantOid: bigint;
    type: SessionParticipantType;
    hash: string;
    upsert: () => Promise<ParticipantWithIdentity>;
  }) => `${d.tenantOid}:${d.type}:${d.hash}`,
  ttlSeconds: 60 * 60,
  provider: async d => await d.upsert()
});

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

  let key = { tenantOid: d.session.tenantOid, type, hash };

  if (d.from.type === 'connection_client') {
    let existing = await db.sessionParticipant.findUnique({
      where: { tenantOid_type_hash: key },
      include: participantInclude
    });

    let isUnchanged =
      existing &&
      existing.identifier === participantData.identifier &&
      existing.name === participantData.name &&
      existing.connectionType === (connectionType ?? null) &&
      isDeepStrictEqual(existing.payload, participantData) &&
      (d.from.agentInstance === undefined ||
        existing.agentInstanceOid === (d.from.agentInstance?.oid ?? null)) &&
      existing.identityActorOid === (d.session.identityActorOid ?? null) &&
      existing.identityOid === (d.session.identityOid ?? null);
    if (existing && isUnchanged) return existing;
  }

  let where = { tenantOid_type_hash: key };

  let update =
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
      : {};

  let upsert = () =>
    withUniqueConstraintRecovery(
      () =>
        db.sessionParticipant.upsert({
          where,
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
              d.from.type === 'connection_client'
                ? (d.session.identityActorOid ?? null)
                : undefined,
            identityOid:
              d.from.type === 'connection_client' ? (d.session.identityOid ?? null) : undefined
          },
          update,
          include: participantInclude
        }),
      async () => {
        try {
          return await db.sessionParticipant.update({
            where,
            data: update,
            include: participantInclude
          });
        } catch (error) {
          if (error instanceof Error && 'code' in error && error.code === 'P2025') return null;
          throw error;
        }
      }
    );

  if (d.from.type === 'connection_client') return await upsert();
  return await getStaticParticipant({ ...key, upsert });
};
