import { randomBytes } from 'crypto';
import type {
  PrismaClient,
  SlateTriggerDelivery,
  SlateTriggerDestination,
  SlateTriggerEvent,
  SlateTriggerReceiver,
  Tenant
} from '../../../prisma/generated/client';
import { getId } from '../../id';
import { defineFactory } from '@lowerdeck/testing-tools';
import { SlateTriggerEventFixtures } from './slateTriggerEventFixtures';
import { SlateTriggerDestinationFixtures } from './slateTriggerDestinationFixtures';

export const SlateTriggerDeliveryFixtures = (db: PrismaClient) => {
  const defaultDelivery = async (data: {
    eventOid: bigint;
    destinationOid: bigint;
    overrides?: Partial<SlateTriggerDelivery>;
  }): Promise<SlateTriggerDelivery> => {
    const { oid, id } = getId('slateTriggerDelivery');

    const factory = defineFactory<SlateTriggerDelivery>(
      {
        oid,
        id,
        eventOid: data.eventOid,
        destinationOid: data.destinationOid,
        signalEventId: `signal_${randomBytes(8).toString('hex')}`,
        ...data.overrides
      } as SlateTriggerDelivery,
      {
        persist: value => db.slateTriggerDelivery.create({ data: value })
      }
    );

    return factory.create(data.overrides ?? {});
  };

  const complete = async (data?: {
    deliveryOverrides?: Partial<SlateTriggerDelivery>;
  }): Promise<{
    delivery: SlateTriggerDelivery;
    event: SlateTriggerEvent;
    destination: SlateTriggerDestination;
    receiver: SlateTriggerReceiver;
    tenant: Tenant;
  }> => {
    const eventFixtures = SlateTriggerEventFixtures(db);
    const { event, receiver, tenant } = await eventFixtures.complete();

    const destinationFixtures = SlateTriggerDestinationFixtures(db);
    const destination = await destinationFixtures.default({
      tenantOid: tenant.oid
    });

    const delivery = await defaultDelivery({
      eventOid: event.oid,
      destinationOid: destination.oid,
      overrides: data?.deliveryOverrides
    });

    return { delivery, event, destination, receiver, tenant };
  };

  return {
    default: defaultDelivery,
    complete
  };
};
