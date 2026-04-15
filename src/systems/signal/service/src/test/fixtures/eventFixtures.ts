import { randomBytes } from 'crypto';
import type { PrismaClient, Event } from '../../../prisma/generated/client';
import { defineFactory } from '@lowerdeck/testing-tools';
import { getId } from '../../id';

export const EventFixtures = (db: PrismaClient) => {
  const defaultEvent = async (data: {
    tenantOid: bigint;
    senderOid: bigint;
    overrides?: Partial<Event>;
  }): Promise<Event> => {
    const { oid, id } = getId('event');
    const eventType =
      data.overrides?.eventType ?? `test.event.${randomBytes(4).toString('hex')}`;
    const topics = data.overrides?.topics ?? ['test'];
    const payloadJson =
      data.overrides?.payloadJson ?? JSON.stringify({ eventType, ok: true });
    const headers =
      data.overrides?.headers ?? ([['content-type', 'application/json']] as [string, string][]);

    const factory = defineFactory<Event>(
      {
        oid,
        id,
        status: data.overrides?.status ?? 'pending',
        topics,
        deliveryDestinationCount: data.overrides?.deliveryDestinationCount ?? -1,
        deliverySuccessCount: data.overrides?.deliverySuccessCount ?? 0,
        deliveryFailureCount: data.overrides?.deliveryFailureCount ?? 0,
        eventType,
        payloadJson,
        onlyForDestinations: data.overrides?.onlyForDestinations ?? [],
        hasOnlyForDestinationsFilter:
          data.overrides?.hasOnlyForDestinationsFilter ??
          !!data.overrides?.onlyForDestinations?.length,
        headers,
        tenantOid: data.tenantOid,
        senderOid: data.senderOid,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data.overrides
      } as Event,
      {
        persist: value => db.event.create({ data: value })
      }
    );

    return factory.create(data.overrides ?? {});
  };

  return {
    default: defaultEvent
  };
};
