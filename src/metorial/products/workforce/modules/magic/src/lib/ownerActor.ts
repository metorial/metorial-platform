import { db } from '@metorial/db';

export let magicMcpServerOwnerActorSelect = {
  select: {
    id: true,
    type: true,
    consumerActor: { select: { consumer: { select: { id: true } } } }
  }
} as const;

export let resolveOwnerActorOid = async (owner?: { identityActorId?: string | null }) => {
  if (!owner?.identityActorId) return null;

  let identityActor = await db.identityActor.findUnique({
    where: { id: owner.identityActorId },
    select: { oid: true }
  });

  return identityActor?.oid ?? null;
};
