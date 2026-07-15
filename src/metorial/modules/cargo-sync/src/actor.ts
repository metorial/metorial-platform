import { db } from '@metorial/db';

export let resolveResourceActorLinks = async (row: {
  id: string;
  organizationActorId?: string | null;
  consumerId?: string | null;
}) => {
  let organizationActor = row.organizationActorId
    ? await db.organizationActor.findUnique({
        where: { id: row.organizationActorId },
        select: { oid: true }
      })
    : await db.organizationActor.findFirst({
        where: { cargoActorId: row.id },
        select: { oid: true }
      });
  let consumer = row.consumerId
    ? await db.consumer.findUnique({
        where: { id: row.consumerId },
        select: { oid: true }
      })
    : await db.consumer.findFirst({
        where: { cargoActorId: row.id },
        select: { oid: true }
      });

  if (organizationActor && consumer) {
    return {
      organizationActorOid: null,
      consumerOid: null,
      conflict: true
    };
  }

  return {
    organizationActorOid: organizationActor?.oid ?? null,
    consumerOid: consumer?.oid ?? null,
    conflict: false
  };
};
