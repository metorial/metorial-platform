import { createLocallyCachedFunction } from '@lowerdeck/cache';
import { db } from '../db';

let normalizeIdentifier = (identifier: string) => identifier.trim().toLowerCase();

let getConsumerByIdentifierCached = createLocallyCachedFunction({
  getHash: (identifier: string) => identifier,
  ttlSeconds: 60 * 10,
  provider: (identifier: string) =>
    db.consumer.findUnique({
      where: { identifier }
    })
});

let getConsumerByIdCached = createLocallyCachedFunction({
  getHash: (d: { id: string }) => d.id,
  ttlSeconds: 60 * 10,
  provider: (d: { id: string }) => {
    let identifier = normalizeIdentifier(d.id);
    return db.consumer.findFirst({
      where: { OR: [{ id: d.id }, { identifier }] }
    });
  }
});

let getConsumerInstanceForAuthCached = createLocallyCachedFunction({
  getHash: (consumerInstanceId: string) => consumerInstanceId,
  ttlSeconds: 60,
  provider: (consumerInstanceId: string) =>
    db.consumerInstance.findUnique({
      where: { id: consumerInstanceId },
      include: { consumer: true }
    })
});

export let loadConsumerByIdentifier = (identifier: string) =>
  getConsumerByIdentifierCached(identifier);

export let loadConsumerById = (d: { id: string }) => getConsumerByIdCached(d);

export let loadConsumerInstanceForAuth = async (consumerInstanceId: string) => {
  let consumerInstance = await getConsumerInstanceForAuthCached(consumerInstanceId);
  if (!consumerInstance) return null;

  let volatile = await db.consumerInstance.findUnique({
    where: { id: consumerInstanceId },
    select: {
      status: true,
      revokedAt: true,
      tokenNonce: true,
      expiresAt: true
    }
  });
  if (!volatile) return null;

  return {
    ...consumerInstance,
    ...volatile
  };
};

export let clearConsumerInstanceAuthCache = (consumerInstanceId: string) =>
  getConsumerInstanceForAuthCached.clearAndWait(consumerInstanceId);

export let clearConsumerCache = async (d: { identifier?: string; id?: string }) => {
  if (d.identifier) await getConsumerByIdentifierCached.clearAndWait(d.identifier);
  if (d.id) await getConsumerByIdCached.clearAndWait({ id: d.id });
};
