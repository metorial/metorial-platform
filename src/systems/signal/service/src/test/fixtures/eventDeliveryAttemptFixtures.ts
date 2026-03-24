import type { EventDeliveryAttempt, PrismaClient } from '../../../prisma/generated/client';
import { defineFactory } from '@lowerdeck/testing-tools';
import { getId } from '../../id';

export const EventDeliveryAttemptFixtures = (db: PrismaClient) => {
  const defaultAttempt = async (data: {
    intentOid: bigint;
    destinationInstanceOid: bigint;
    overrides?: Partial<EventDeliveryAttempt>;
  }): Promise<EventDeliveryAttempt> => {
    const { oid, id } = getId('eventDeliveryAttempt');

    const factory = defineFactory<EventDeliveryAttempt>(
      {
        oid,
        id,
        status: data.overrides?.status ?? 'failed',
        attemptNumber: data.overrides?.attemptNumber ?? 1,
        durationMs: data.overrides?.durationMs ?? 120,
        errorCode: data.overrides?.errorCode ?? null,
        errorMessage: data.overrides?.errorMessage ?? null,
        responseStatusCode: data.overrides?.responseStatusCode ?? null,
        destinationInstanceOid: data.destinationInstanceOid,
        intentOid: data.intentOid,
        createdAt: data.overrides?.createdAt ?? new Date(),
        ...data.overrides
      } as EventDeliveryAttempt,
      {
        persist: value => db.eventDeliveryAttempt.create({ data: value })
      }
    );

    return factory.create(data.overrides ?? {});
  };

  return {
    default: defaultAttempt
  };
};
