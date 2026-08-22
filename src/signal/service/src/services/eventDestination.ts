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
  Prisma,
  Sender,
  Tenant,
  WebhookMethod
} from '../../prisma/generated/client';
import { db } from '../db';
import { getId, snowflake } from '../id';
import { senderService } from './sender';

let include = {
  currentInstance: {
    include: {
      webhook: true
    }
  }
} as const;

type MaterializedEventDestination = Prisma.EventDestinationGetPayload<{
  include: typeof include;
}>;

export type CallbackEventDestinationInput = {
  externalId: string;
  name: string;
  description?: string | null;
  eventTypes?: string[] | null;
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

let CALLBACK_SENDER = {
  identifier: 'callbacks',
  name: 'Callbacks'
};

let arraysEqual = (left: string[], right: string[]) =>
  left.length === right.length && left.every((value, index) => value === right[index]);

class eventDestinationServiceImpl {
  async upsertCallbackDestinationByExternalId(d: {
    input: CallbackEventDestinationInput;
    tenant: Tenant;
    sender?: Sender;
    prisma?: Parameters<Parameters<typeof db.$transaction>[0]>[0];
  }): Promise<MaterializedEventDestination> {
    let sender = d.sender ?? (await senderService.upsertSender({ input: CALLBACK_SENDER }));
    if (!d.prisma) {
      return await db.$transaction(
        async prisma =>
          await this.upsertCallbackDestinationByExternalId({
            ...d,
            sender,
            prisma
          })
      );
    }
    let prisma = d.prisma;
    let ownership = await prisma.eventDestination.findFirst({
      where: { externalId: d.input.externalId },
      select: { tenantOid: true, senderOid: true, isCallbackDestination: true }
    });
    if (
      ownership &&
      (ownership.tenantOid !== d.tenant.oid ||
        ownership.senderOid !== sender.oid ||
        !ownership.isCallbackDestination)
    ) {
      throw new ServiceError(
        badRequestError({ message: 'Webhook destination ownership is invalid.' })
      );
    }

    let existing = await prisma.eventDestination.findFirst({
      where: {
        externalId: d.input.externalId,
        tenantOid: d.tenant.oid,
        senderOid: sender.oid,
        isCallbackDestination: true
      },
      include
    });

    if (!existing) {
      let destinationId = getId('eventDestination');
      let webhook = await prisma.webhookDestinationWebhook.create({
        data: {
          ...getId('eventDestinationWebhook'),
          url: d.input.variant.url,
          method: d.input.variant.method,
          signingSecret: generateCustomId('metorial_whsec_', 50),
          tenantOid: d.tenant.oid
        }
      });
      let destination = await prisma.eventDestination.create({
        data: {
          ...destinationId,
          id: d.input.externalId,
          externalId: d.input.externalId,
          status: 'active',
          isCallbackDestination: true,
          type: 'http_endpoint',
          eventTypes: d.input.eventTypes ?? [],
          hasEventTypesFilter: !!d.input.eventTypes?.length,
          name: d.input.name,
          description: d.input.description,
          retryType: d.input.retry?.type ?? 'linear',
          retryDelaySeconds: d.input.retry?.delaySeconds ?? 30,
          retryMaxAttempts: d.input.retry?.maxAttempts ?? 5,
          tenantOid: d.tenant.oid,
          senderOid: sender.oid
        }
      });
      let instance = await prisma.eventDestinationInstance.create({
        data: {
          oid: snowflake.nextId(),
          type: 'http_endpoint',
          webhookOid: webhook.oid,
          destinationOid: destination.oid
        }
      });
      return await prisma.eventDestination.update({
        where: { oid: destination.oid },
        data: { currentInstanceOid: instance.oid },
        include
      });
    }

    let eventTypes = d.input.eventTypes ?? [];
    let retryType = d.input.retry?.type ?? existing.retryType;
    let retryDelaySeconds = d.input.retry?.delaySeconds ?? existing.retryDelaySeconds;
    let retryMaxAttempts = d.input.retry?.maxAttempts ?? existing.retryMaxAttempts;
    let description =
      d.input.description === undefined ? existing.description : d.input.description;
    if (
      existing.status === 'active' &&
      existing.isCallbackDestination &&
      existing.senderOid === sender.oid &&
      existing.name === d.input.name &&
      existing.description === description &&
      arraysEqual(existing.eventTypes, eventTypes) &&
      existing.hasEventTypesFilter === eventTypes.length > 0 &&
      existing.retryType === retryType &&
      existing.retryDelaySeconds === retryDelaySeconds &&
      existing.retryMaxAttempts === retryMaxAttempts &&
      existing.currentInstance?.type === d.input.variant.type &&
      existing.currentInstance.webhook?.url === d.input.variant.url &&
      existing.currentInstance.webhook.method === d.input.variant.method
    ) {
      return existing;
    }

    let webhook = await prisma.webhookDestinationWebhook.create({
      data: {
        ...getId('eventDestinationWebhook'),
        url: d.input.variant.url,
        method: d.input.variant.method,
        signingSecret:
          existing.currentInstance?.webhook?.signingSecret ??
          generateCustomId('metorial_whsec_', 50),
        tenantOid: existing.tenantOid
      }
    });
    let instance = await prisma.eventDestinationInstance.create({
      data: {
        oid: snowflake.nextId(),
        type: d.input.variant.type,
        webhookOid: webhook.oid,
        destinationOid: existing.oid
      }
    });
    return await prisma.eventDestination.update({
      where: { oid: existing.oid },
      data: {
        status: 'active',
        isCallbackDestination: true,
        senderOid: sender.oid,
        name: d.input.name,
        description,
        eventTypes,
        hasEventTypesFilter: eventTypes.length > 0,
        retryType: d.input.retry?.type,
        retryDelaySeconds: d.input.retry?.delaySeconds,
        retryMaxAttempts: d.input.retry?.maxAttempts,
        currentInstanceOid: instance.oid
      },
      include
    });
  }

  async createEventDestination(d: {
    input: {
      externalId?: string;
      isCallbackDestination?: boolean;
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
      let destinationId = getId('eventDestination');
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
          ...destinationId,
          id: d.input.externalId ?? destinationId.id,
          externalId: d.input.externalId,

          status: 'active',
          isCallbackDestination: d.input.isCallbackDestination ?? false,
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
      isCallbackDestination?: boolean;

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
        isCallbackDestination: d.input.isCallbackDestination,

        ...(d.input.eventTypes
          ? {
              eventTypes: d.input.eventTypes,
              hasEventTypesFilter: !!d.input.eventTypes.length
            }
          : {}),

        retryType: d.input.retry?.type,
        retryDelaySeconds: d.input.retry?.delaySeconds,
        retryMaxAttempts: d.input.retry?.maxAttempts,
        currentInstanceOid: instance?.oid
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

  async rotateSigningSecret(d: { eventDestination: EventDestination; tenant: Tenant }) {
    if (
      d.eventDestination.status !== 'active' ||
      d.eventDestination.tenantOid !== d.tenant.oid
    ) {
      throw new ServiceError(notFoundError('event_destination'));
    }

    let signingSecret = generateCustomId('metorial_whsec_', 50);
    let rotatedAt = new Date();
    let eventDestination = await db.$transaction(async tx => {
      let materialized = await tx.eventDestination.findFirst({
        where: {
          oid: d.eventDestination.oid,
          tenantOid: d.tenant.oid,
          status: 'active'
        },
        include
      });
      let webhook = materialized?.currentInstance?.webhook;
      if (!webhook) {
        throw new ServiceError(
          preconditionFailedError({
            code: 'webhook_destination_not_materialized',
            message: 'The webhook destination has not been materialized in Signal.'
          })
        );
      }

      await tx.webhookDestinationWebhook.update({
        where: { oid: webhook.oid },
        data: { signingSecret }
      });

      return await tx.eventDestination.findFirstOrThrow({
        where: { oid: materialized!.oid },
        include
      });
    });

    return { eventDestination, signingSecret, rotatedAt };
  }
}

export let eventDestinationService = Service.create(
  'eventDestinationService',
  () => new eventDestinationServiceImpl()
).build();
