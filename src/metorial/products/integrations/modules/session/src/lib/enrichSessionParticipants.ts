import { metorialDb } from '@metorial-subspace/module-tenant';

type SessionParticipantLike = {
  id: string;
  identityActorId?: string | null;
  identityActor?: { id: string } | null;
};

let getIdentityActorId = (participant: SessionParticipantLike) =>
  participant.identityActorId ?? participant.identityActor?.id ?? null;

export let enrichSessionParticipantsWithConsumer = async <
  T extends SessionParticipantLike
>(d: {
  instanceOid: bigint;
  participants: T[];
}) => {
  let actorIds = [
    ...new Set(
      d.participants.map(participant => getIdentityActorId(participant)).filter(Boolean)
    )
  ] as string[];

  if (!actorIds.length) return d.participants;

  let consumerActors = await metorialDb.consumerActor.findMany({
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

  return d.participants.map(participant => {
    let identityActorId = getIdentityActorId(participant);

    return {
      ...participant,
      identityActorId,
      consumerId: identityActorId ? (consumerByActorId.get(identityActorId) ?? null) : null
    };
  });
};
