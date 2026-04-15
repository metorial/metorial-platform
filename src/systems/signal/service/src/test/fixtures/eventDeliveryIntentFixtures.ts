import type { EventDeliveryIntent, PrismaClient } from '../../../prisma/generated/client';
import { defineFactory } from '@lowerdeck/testing-tools';
import { getId } from '../../id';

export const EventDeliveryIntentFixtures = (db: PrismaClient) => {
  const defaultIntent = async (data: {
    eventOid: bigint;
    destinationOid: bigint;
    overrides?: Partial<EventDeliveryIntent>;
  }): Promise<EventDeliveryIntent> => {
    const { oid, id } = getId('eventDeliveryIntent');

    const factory = defineFactory<EventDeliveryIntent>(
      {
        oid,
        id,
        status: data.overrides?.status ?? 'pending',
        attemptCount: data.overrides?.attemptCount ?? 0,
        errorCode: data.overrides?.errorCode ?? null,
        errorMessage: data.overrides?.errorMessage ?? null,
        eventOid: data.eventOid,
        destinationOid: data.destinationOid,
        lastAttemptAt: data.overrides?.lastAttemptAt ?? null,
        nextAttemptAt: data.overrides?.nextAttemptAt ?? null,
        createdAt: data.overrides?.createdAt ?? new Date(),
        updatedAt: data.overrides?.updatedAt ?? new Date(),
        ...data.overrides
      } as EventDeliveryIntent,
      {
        persist: value => db.eventDeliveryIntent.create({ data: value })
      }
    );

    return factory.create(data.overrides ?? {});
  };

  return {
    default: defaultIntent
  };
};
