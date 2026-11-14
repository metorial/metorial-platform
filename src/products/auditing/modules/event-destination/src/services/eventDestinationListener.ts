import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { callbackService } from '@metorial-subspace/module-callback';
import { providerService, providerTriggerService } from '@metorial-subspace/module-catalog';
import { chatConnectionService } from '@metorial-subspace/module-chat';
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
import {
  MAX_ACTIVE_LISTENERS_PER_DESTINATION,
  MAX_ACTIVE_LISTENERS_PER_ORGANIZATION
} from '@metorial/module-event-delivery';
import { chatEventNames, webhookEvents } from '@metorial/webhook-event-schema';
import { buildListenerTargetOrBlocks } from '../lib/listenerTargetMatch';

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

  private assertValidChatEventTypes(eventTypes: string[]) {
    let invalid = eventTypes.filter(
      eventType => !(chatEventNames as readonly string[]).includes(eventType)
    );
    if (invalid.length > 0) {
      throw new ServiceError(
        badRequestError({
          message: `Unknown chat event type(s): ${invalid.join(', ')}`,
          description:
            'Every entry in `event_types` must be a Metorial-declared chat event type.'
        })
      );
    }
  }

  private async assertValidCallbackTriggers(d: {
    instance: Instance;
    callbackId: string;
    triggers: string[];
  }) {
    if (d.triggers.length === 0) return;

    let callback = await callbackService.getCallbackById({
      instance: d.instance,
      callbackId: d.callbackId
    });

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

  private async assertValidCallbackTarget(d: {
    instance: Instance;
    callbackId?: string;
    providerId?: string;
    triggers: string[];
  }): Promise<{ callbackId: string | null; providerId: string | null }> {
    if (d.callbackId && d.providerId) {
      throw new ServiceError(
        badRequestError({
          message: 'Only one of `callback_id` or `provider_id` may be set',
          description:
            'A callback listener targets a specific callback, all callbacks of one provider, or (with neither set) all callbacks.'
        })
      );
    }

    if (d.callbackId) {
      let callback = await callbackService.getCallbackById({
        instance: d.instance,
        callbackId: d.callbackId
      });
      await this.assertValidCallbackTriggers({
        instance: d.instance,
        callbackId: d.callbackId,
        triggers: d.triggers
      });
      return { callbackId: callback.id, providerId: null };
    }

    if (d.providerId) {
      let provider = await providerService.getProviderById({
        instance: d.instance,
        providerId: d.providerId
      });
      return { callbackId: null, providerId: provider.id };
    }

    return { callbackId: null, providerId: null };
  }

  private async assertValidChatTarget(d: {
    instance: Instance;
    chatConnectionId?: string;
    providerId?: string;
    eventTypes: string[];
  }): Promise<{ chatConnectionId: string | null; providerId: string | null }> {
    if (d.chatConnectionId && d.providerId) {
      throw new ServiceError(
        badRequestError({
          message: 'Only one of `chat_connection_id` or `provider_id` may be set',
          description:
            'A chat listener targets a specific chat connection, all connections of one provider, or (with neither set) all chat connections.'
        })
      );
    }

    this.assertValidChatEventTypes(d.eventTypes);

    if (d.chatConnectionId) {
      let chatConnection = await chatConnectionService.getChatConnectionById({
        instance: d.instance,
        chatConnectionId: d.chatConnectionId
      });
      return { chatConnectionId: chatConnection.id, providerId: null };
    }

    if (d.providerId) {
      let provider = await providerService.getProviderById({
        instance: d.instance,
        providerId: d.providerId
      });
      return { chatConnectionId: null, providerId: provider.id };
    }

    return { chatConnectionId: null, providerId: null };
  }

  async listEventDestinationListeners(d: {
    organization: Organization;
    instanceIds?: string[];
    eventDestinationIds?: string[];
    callbackIds?: string[];
    chatConnectionIds?: string[];
    providerIds?: string[];
    types?: EventDestinationListenerType[];
  }) {
    let andConditions = await buildListenerTargetOrBlocks({
      callbackIds: d.callbackIds,
      chatConnectionIds: d.chatConnectionIds
    });

    return Paginator.create(({ prisma }) =>
      prisma(async opts =>
        db.eventDestinationListener.findMany({
          ...opts,
          where: {
            instance: {
              organizationOid: d.organization.oid,
              id: d.instanceIds ? { in: d.instanceIds } : undefined
            },
            eventDestination: {
              status: 'active',
              ...(d.eventDestinationIds ? { id: { in: d.eventDestinationIds } } : {})
            },
            type: d.types ? { in: d.types } : undefined,
            providerId: d.providerIds ? { in: d.providerIds } : undefined,
            AND: andConditions.length ? andConditions : undefined
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
          callbackId?: string;
          providerId?: string;
          triggers: string[];
        }
      | {
          eventDestinationId: string;
          type: 'chat';
          chatConnectionId?: string;
          providerId?: string;
          eventTypes: string[];
        };
  }) {
    let eventDestination = await this.getOrganizationEventDestination({
      instance: d.instance,
      eventDestinationId: d.input.eventDestinationId
    });

    let [destinationListenerCount, organizationListenerCount] = await Promise.all([
      db.eventDestinationListener.count({
        where: { eventDestinationOid: eventDestination.oid }
      }),
      db.eventDestinationListener.count({
        where: { instance: { organizationOid: d.instance.organizationOid } }
      })
    ]);

    if (destinationListenerCount >= MAX_ACTIVE_LISTENERS_PER_DESTINATION) {
      throw new ServiceError(
        badRequestError({
          message: `An event destination may have at most ${MAX_ACTIVE_LISTENERS_PER_DESTINATION} listeners`,
          description: 'Delete an existing listener on this destination before adding another.'
        })
      );
    }

    if (organizationListenerCount >= MAX_ACTIVE_LISTENERS_PER_ORGANIZATION) {
      throw new ServiceError(
        badRequestError({
          message: `An organization may have at most ${MAX_ACTIVE_LISTENERS_PER_ORGANIZATION} event destination listeners in total`,
          description: 'Delete an existing event destination listener before adding another.'
        })
      );
    }

    let callbackTarget: { callbackId: string | null; providerId: string | null } | null = null;
    let chatTarget: { chatConnectionId: string | null; providerId: string | null } | null =
      null;

    if (d.input.type == 'event') {
      this.assertValidEventTypes(d.input.eventTypes);
    } else if (d.input.type == 'chat') {
      chatTarget = await this.assertValidChatTarget({
        instance: d.instance,
        chatConnectionId: d.input.chatConnectionId,
        providerId: d.input.providerId,
        eventTypes: d.input.eventTypes
      });
    } else {
      callbackTarget = await this.assertValidCallbackTarget({
        instance: d.instance,
        callbackId: d.input.callbackId,
        providerId: d.input.providerId,
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
          eventTypes: d.input.type == 'callback' ? [] : d.input.eventTypes,
          callbackId: d.input.type == 'callback' ? callbackTarget!.callbackId : null,
          triggers: d.input.type == 'callback' ? d.input.triggers : [],
          chatConnectionId: d.input.type == 'chat' ? chatTarget!.chatConnectionId : null,
          providerId:
            d.input.type == 'callback'
              ? callbackTarget!.providerId
              : d.input.type == 'chat'
                ? chatTarget!.providerId
                : null
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

    if (d.listener.type == 'chat' && d.input.eventTypes) {
      this.assertValidChatEventTypes(d.input.eventTypes);
    }

    if (d.listener.type == 'callback' && d.input.triggers && d.listener.callbackId) {
      await this.assertValidCallbackTriggers({
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
