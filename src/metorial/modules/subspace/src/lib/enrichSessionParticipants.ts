import { db } from '@metorial/db';

type SessionParticipantLike = {
  id: string;
  identityActorId?: string | null;
};

export let enrichSessionParticipantsWithConsumer = async <
  T extends SessionParticipantLike
>(d: {
  instanceOid: bigint;
  participants: T[];
}) => {
  let actorIds = [
    ...new Set(d.participants.map(participant => participant.identityActorId).filter(Boolean))
  ] as string[];

  if (!actorIds.length) return d.participants;

  let consumerActors = await db.consumerActor.findMany({
    where: {
      instanceOid: d.instanceOid,
      id: {
        in: actorIds
      }
    },
    select: {
      id: true,
      instanceConsumer: {
        select: {
          id: true
        }
      }
    }
  });

  let consumerByActorId = new Map(
    consumerActors.map(actor => [actor.id, actor.instanceConsumer.id] as const)
  );

  return d.participants.map(participant => ({
    ...participant,
    consumerId: participant.identityActorId
      ? (consumerByActorId.get(participant.identityActorId) ?? null)
      : null
  }));
};
