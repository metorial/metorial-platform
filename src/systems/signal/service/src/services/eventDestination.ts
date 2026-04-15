import {
  badRequestError,
  notFoundError,
  preconditionFailedError,
  ServiceError
} from '@lowerdeck/error';
import { generateCustomId } from '@lowerdeck/id';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type {
  EventDestination,
  EventDestinationInstance,
  EventRetryType,
  Sender,
  Tenant,
  WebhookMethod
} from '../../prisma/generated/client';
import { db } from '../db';
import { getId, snowflake } from '../id';

let include = {
  currentInstance: {
    include: {
      webhook: true
    }
  }
};

class eventDestinationServiceImpl {
  async createEventDestination(d: {
    input: {
      name: string;
      description?: string;
      eventTypes?: string[];

      retry?: {
        type: EventRetryType;
        delaySeconds: number;
        maxAttempts: number;
      };

      variant: {
        type: 'http_endpoint';
        url: string;
        method: WebhookMethod;
      };
    };
    tenant: Tenant;
    sender: Sender;
  }) {
    return db.$transaction(async db => {
      let webhook = await db.webhookDestinationWebhook.create({
        data: {
          ...getId('eventDestinationWebhook'),

          url: d.input.variant.url,
          method: d.input.variant.method,

          signingSecret: generateCustomId('metorial_whsec_', 50),

          tenantOid: d.tenant.oid
        }
      });

      let destination = await db.eventDestination.create({
        data: {
          ...getId('eventDestination'),

          status: 'active',
          type: 'http_endpoint',

          eventTypes: d.input.eventTypes || [],
          hasEventTypesFilter: !!d.input.eventTypes?.length,

          name: d.input.name,
          description: d.input.description,

          retryType: d.input.retry?.type ?? 'linear',
          retryDelaySeconds: d.input.retry?.delaySeconds ?? 30,
          retryMaxAttempts: d.input.retry?.maxAttempts ?? 5,

          tenantOid: d.tenant.oid,
          senderOid: d.sender.oid
        }
      });

      let instance = await db.eventDestinationInstance.create({
        data: {
          oid: snowflake.nextId(),
          type: 'http_endpoint',
          webhookOid: webhook.oid,
          destinationOid: destination.oid
        }
      });

      return await db.eventDestination.update({
        where: { oid: destination.oid },
        data: { currentInstanceOid: instance.oid },
        include
      });
    });
  }

  async getEventDestinationById(d: { id: string; tenant: Tenant }) {
    let func = await db.eventDestination.findFirst({
      where: {
        id: d.id,
        tenantOid: d.tenant.oid,
        status: 'active'
      },
      include
    });
    if (!func) throw new ServiceError(notFoundError('event_destination'));
    return func;
  }

  async listEventDestinations(d: { tenant: Tenant }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.eventDestination.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              status: 'active'
            },
            include
          })
      )
    );
  }

  async getManyEventDestinationsByIds(d: { ids: string[]; tenant: Tenant; sender: Sender }) {
    return await db.eventDestination.findMany({
      where: {
        id: { in: d.ids },
        tenantOid: d.tenant.oid,
        senderOid: d.sender.oid,
        status: 'active'
      },
      include
    });
  }

  async updateEventDestination(d: {
    eventDestination: EventDestination;
    input: {
      name?: string;
      description?: string;
      eventTypes?: string[];

      retry?: {
        type: EventRetryType;
        delaySeconds: number;
        maxAttempts: number;
      };

      variant?: {
        type: 'http_endpoint';
        url: string;
        method: WebhookMethod;
      };
    };
  }) {
    if (d.eventDestination.status == 'inactive') {
      throw new ServiceError(
        preconditionFailedError({
          message: 'Cannot update an inactive event destination'
        })
      );
    }

    let instance: EventDestinationInstance | null = null;

    if (d.input.variant) {
      if (d.eventDestination.type != d.input.variant.type) {
        throw new ServiceError(
          badRequestError({
            message: 'Cannot change event destination variant type'
          })
        );
      }

      let anyCurrentInstance = await db.eventDestinationInstance.findFirst({
        where: {
          destinationOid: d.eventDestination.oid,
          type: d.input.variant.type
        },
        include: { webhook: true },
        orderBy: { createdAt: 'desc' }
      });

      let webhook = await db.webhookDestinationWebhook.create({
        data: {
          ...getId('eventDestinationWebhook'),

          url: d.input.variant.url,
          method: d.input.variant.method,

          signingSecret:
            anyCurrentInstance?.webhook?.signingSecret ??
            generateCustomId('metorial_whsec_', 50),

          tenantOid: d.eventDestination.tenantOid
        }
      });

      instance = await db.eventDestinationInstance.create({
        data: {
          oid: snowflake.nextId(),
          type: d.input.variant.type,
          webhookOid: webhook.oid,
          destinationOid: d.eventDestination.oid
        }
      });
    }

    return await db.eventDestination.update({
      where: { oid: d.eventDestination.oid },
      data: {
        name: d.input.name,
        description: d.input.description,

        ...(d.input.eventTypes
          ? {
              eventTypes: d.input.eventTypes,
              hasEventTypesFilter: !!d.input.eventTypes.length
            }
          : {}),

        retryType: d.input.retry?.type,
        retryDelaySeconds: d.input.retry?.delaySeconds,
        retryMaxAttempts: d.input.retry?.maxAttempts
      },
      include
    });
  }

  async deleteEventDestination(d: { eventDestination: EventDestination }) {
    if (d.eventDestination.status == 'inactive') {
      throw new ServiceError(
        preconditionFailedError({
          message: 'Event destination is already inactive'
        })
      );
    }

    return await db.eventDestination.update({
      where: { oid: d.eventDestination.oid },
      data: { status: 'inactive', deletedAt: new Date() },
      include
    });
  }
}

export let eventDestinationService = Service.create(
  'eventDestinationService',
  () => new eventDestinationServiceImpl()
).build();
