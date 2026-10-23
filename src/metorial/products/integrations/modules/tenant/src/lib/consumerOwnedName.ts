import { db } from '@metorial-subspace/db';
import { metorialDb } from './metorialDb';

export type ConsumerOwnedResourceKind = 'Config' | 'Auth Config' | 'Connection';

export let getConsumerOwnedResourceName = async (d: {
  ownerActorOid: bigint | null | undefined;
  providerName: string;
  kind: ConsumerOwnedResourceKind;
}) => {
  if (!d.ownerActorOid) return null;

  let owner = await db.identityActor.findUnique({
    where: { oid: d.ownerActorOid },
    select: { id: true, type: true }
  });
  if (owner?.type !== 'consumer') return null;

  let consumerActor = await metorialDb.consumerActor.findUnique({
    where: { id: owner.id },
    select: {
      consumer: { select: { email: true } },
      consumerProfile: { select: { email: true } }
    }
  });
  let email = consumerActor?.consumerProfile.email || consumerActor?.consumer.email;
  if (!email) return null;

  return `${d.providerName} ${d.kind} for ${email}`;
};
