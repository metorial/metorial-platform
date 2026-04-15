import type { PrismaClient } from '../../../prisma/generated/client';
import { EventDeliveryAttemptFixtures } from './eventDeliveryAttemptFixtures';
import { EventDeliveryIntentFixtures } from './eventDeliveryIntentFixtures';
import { EventDestinationFixtures } from './eventDestinationFixtures';
import { EventFixtures } from './eventFixtures';
import { SenderFixtures } from './senderFixtures';
import { TenantFixtures } from './tenantFixtures';

export function fixtures(db: PrismaClient) {
  return {
    tenant: TenantFixtures(db),
    sender: SenderFixtures(db),
    event: EventFixtures(db),
    eventDestination: EventDestinationFixtures(db),
    eventDeliveryIntent: EventDeliveryIntentFixtures(db),
    eventDeliveryAttempt: EventDeliveryAttemptFixtures(db)
  };
}

export {
  TenantFixtures,
  SenderFixtures,
  EventFixtures,
  EventDestinationFixtures,
  EventDeliveryIntentFixtures,
  EventDeliveryAttemptFixtures
};
