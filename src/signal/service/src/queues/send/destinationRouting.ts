import type { Prisma } from '../../../prisma/generated/client';

export type EventDestinationRoutingEvent = {
  callbackOid: bigint | null;
  senderOid: bigint;
  hasOnlyForDestinationsFilter: boolean;
  onlyForDestinations: string[];
};

export let buildEventDestinationDeliveryCompatibilityWhere = (
  event: EventDestinationRoutingEvent
): Prisma.EventDestinationWhereInput => {
  if (event.callbackOid != null) {
    return {
      senderOid: event.senderOid,
      isCallbackDestination: true,
      callbackDestinationLinks: {
        some: {
          callbackOid: event.callbackOid
        }
      },
      id: event.hasOnlyForDestinationsFilter
        ? { in: event.onlyForDestinations }
        : undefined
    };
  }

  if (event.hasOnlyForDestinationsFilter) {
    return {
      id: { in: event.onlyForDestinations }
    };
  }

  return {
    senderOid: event.senderOid,
    isCallbackDestination: false
  };
};

export let buildEventDestinationSelectionWhere = (
  event: EventDestinationRoutingEvent & { eventType: string }
): Prisma.EventDestinationWhereInput => {
  let compatibilityWhere = buildEventDestinationDeliveryCompatibilityWhere(event);

  return {
    status: 'active',
    ...compatibilityWhere,
    ...(event.callbackOid != null
      ? {
          callbackDestinationLinks: {
            some: {
              callbackOid: event.callbackOid,
              status: 'active' as const
            }
          }
        }
      : {}),
    AND: [
      {
        OR: [{ hasEventTypesFilter: false }, { eventTypes: { has: event.eventType } }]
      }
    ]
  };
};
