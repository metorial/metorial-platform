import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { callbackService } from '@metorial-subspace/module-callback';
import { providerTriggerService } from '@metorial-subspace/module-catalog';
import type { AuditScope } from '@metorial/audit-scope';
import {
  db,
  EventDestination,
  EventDestinationListener,
  type EventDestinationListenerType,
  ID,
  Instance,
  Organization,
  withTransaction
} from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { webhookEvents } from '@metorial/webhook-event-schema';

export let eventDestinationListenerInclude = {
  eventDestination: true,
  instance: {
    include: {
      organization: true,
      project: true
    }
  }
} as const;

class EventDestinationListenerServiceImpl {
  private async getOrganizationEventDestination(d: {
    instance: Instance;
    eventDestinationId: string;
  }) {
    let eventDestination = await db.eventDestination.findFirst({
      where: { id: d.eventDestinationId, organizationOid: d.instance.organizationOid }
    });

    if (!eventDestination) {
      throw new ServiceError(
        notFoundError('organization.event_destination', d.eventDestinationId)
      );
    }

    if (eventDestination.status != 'active') {
      throw new ServiceError(
        badRequestError({
          message: 'Cannot perform this action on an archived event destination'
        })
      );
    }

    return eventDestination;
  }

  private assertValidEventTypes(eventTypes: string[]) {
    let unknown = eventTypes.filter(eventType => !(eventType in webhookEvents));
    if (unknown.length > 0) {
      throw new ServiceError(
        badRequestError({
          message: `Unknown event type(s): ${unknown.join(', ')}`,
          description: 'Every entry in `event_types` must be a Metorial-declared event type.'
        })
      );
    }
  }

  private async assertValidCallbackAndTriggers(d: {
    instance: Instance;
    callbackId: string;
    triggers: string[];
  }) {
    let callback = await callbackService.getCallbackById({
      instance: d.instance,
      callbackId: d.callbackId
    });

    if (d.triggers.length === 0) return;

    let validKeys = await providerTriggerService.getValidTriggerKeysForProviderVariant({
      providerVariantOid: callback.providerVariantOid,
      keys: d.triggers
    });
    let invalid = d.triggers.filter(key => !validKeys.includes(key));
    if (invalid.length > 0) {
      throw new ServiceError(
        badRequestError({
          message: `Unknown trigger key(s) for this callback: ${invalid.join(', ')}`,
          description:
            "Every entry in `triggers` must be a valid trigger key for the callback's provider."
        })
      );
    }
  }

  async listEventDestinationListeners(d: {
    organization: Organization;
    instanceIds?: string[];
    eventDestinationIds?: string[];
    callbackIds?: string[];
    types?: EventDestinationListenerType[];
  }) {
    return Paginator.create(({ prisma }) =>
      prisma(async opts =>
        db.eventDestinationListener.findMany({
          ...opts,
          where: {
            instance: {
              organizationOid: d.organization.oid,
              id: d.instanceIds ? { in: d.instanceIds } : undefined
            },
            eventDestination: d.eventDestinationIds
              ? { id: { in: d.eventDestinationIds } }
              : undefined,
            callbackId: d.callbackIds ? { in: d.callbackIds } : undefined,
            type: d.types ? { in: d.types } : undefined
          },
          include: eventDestinationListenerInclude
        })
      )
    );
  }

  async getEventDestinationListenerById(d: {
    organization: Organization;
    eventDestinationListenerId: string;
  }) {
    let listener = await db.eventDestinationListener.findFirst({
      where: {
        id: d.eventDestinationListenerId,
        instance: { organizationOid: d.organization.oid }
      },
      include: eventDestinationListenerInclude
    });

    if (!listener) {
      throw new ServiceError(
        notFoundError('instance.event_destination_listener', d.eventDestinationListenerId)
      );
    }

    return listener;
  }

  async createEventDestinationListener(d: {
    instance: Instance;
    auditScope: AuditScope;
    input:
      | { eventDestinationId: string; type: 'event'; eventTypes: string[] }
      | {
          eventDestinationId: string;
          type: 'callback';
          callbackId: string;
          triggers: string[];
        };
  }) {
    let eventDestination = await this.getOrganizationEventDestination({
      instance: d.instance,
      eventDestinationId: d.input.eventDestinationId
    });

    if (d.input.type == 'event') {
      this.assertValidEventTypes(d.input.eventTypes);
    } else {
      await this.assertValidCallbackAndTriggers({
        instance: d.instance,
        callbackId: d.input.callbackId,
        triggers: d.input.triggers
      });
    }

    return withTransaction(async db => {
      await Fabric.fire('instance.event_destination_listener.created:before', {
        instance: d.instance,
        auditScope: d.auditScope,
        input: { type: d.input.type }
      });

      let listener = await db.eventDestinationListener.create({
        data: {
          id: await ID.generateId('eventDestinationListener'),
          type: d.input.type,
          instanceOid: d.instance.oid,
          eventDestinationOid: eventDestination.oid,
          eventTypes: d.input.type == 'event' ? d.input.eventTypes : [],
          callbackId: d.input.type == 'callback' ? d.input.callbackId : null,
          triggers: d.input.type == 'callback' ? d.input.triggers : []
        },
        include: eventDestinationListenerInclude
      });

      await Fabric.fire('instance.event_destination_listener.created:after', {
        instance: d.instance,
        auditScope: d.auditScope,
        listener,
        input: { type: d.input.type }
      });

      return listener;
    });
  }

  async updateEventDestinationListener(d: {
    instance: Instance;
    listener: EventDestinationListener & { eventDestination: EventDestination };
    auditScope: AuditScope;
    input: { eventTypes?: string[]; triggers?: string[] };
  }) {
    if (d.listener.type == 'event' && d.input.eventTypes) {
      this.assertValidEventTypes(d.input.eventTypes);
    }
    if (d.listener.type == 'callback' && d.input.triggers && d.listener.callbackId) {
      await this.assertValidCallbackAndTriggers({
        instance: d.instance,
        callbackId: d.listener.callbackId,
        triggers: d.input.triggers
      });
    }

    return withTransaction(async db => {
      await Fabric.fire('instance.event_destination_listener.updated:before', {
        instance: d.instance,
        auditScope: d.auditScope,
        listener: d.listener,
        input: d.input
      });

      let listener = await db.eventDestinationListener.update({
        where: { oid: d.listener.oid },
        data: {
          eventTypes: d.input.eventTypes,
          triggers: d.input.triggers
        },
        include: eventDestinationListenerInclude
      });

      await Fabric.fire('instance.event_destination_listener.updated:after', {
        instance: d.instance,
        auditScope: d.auditScope,
        listener,
        previousListener: d.listener,
        input: d.input
      });

      return listener;
    });
  }

  async deleteEventDestinationListener(d: {
    instance: Instance;
    listener: EventDestinationListener & { eventDestination: EventDestination };
    auditScope: AuditScope;
  }) {
    return withTransaction(async db => {
      await Fabric.fire('instance.event_destination_listener.deleted:before', {
        instance: d.instance,
        auditScope: d.auditScope,
        listener: d.listener
      });

      let listener = await db.eventDestinationListener.delete({
        where: { oid: d.listener.oid },
        include: eventDestinationListenerInclude
      });

      await Fabric.fire('instance.event_destination_listener.deleted:after', {
        instance: d.instance,
        auditScope: d.auditScope,
        listener
      });

      return listener;
    });
  }
}

export let eventDestinationListenerService = Service.create(
  'eventDestinationListenerService',
  () => new EventDestinationListenerServiceImpl()
).build();
