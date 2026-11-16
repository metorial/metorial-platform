import { canonicalize } from '@lowerdeck/canonicalize';
import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Hash } from '@lowerdeck/hash';
import { generateCustomId } from '@lowerdeck/id';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type {
  Callback,
  CallbackEvent,
  CallbackEventStatus,
  EventDeliveryAttemptStatus,
  EventDeliveryIntentStatus,
  EventRetryType,
  Tenant,
  WebhookMethod
} from '../../prisma/generated/client';
import { db } from '../db';
import { getId, snowflake } from '../id';
import { offloadCallbackEventPayloadQueue } from '../queues/send/callbackEventPayload';
import { newEventQueue } from '../queues/send/init';
import { senderService } from './sender';

let callbackInclude = {
  destinations: {
    include: {
      eventDestination: {
        include: {
          currentInstance: {
            include: {
              webhook: true
            }
          }
        }
      }
    }
  }
};

let intentInclude = {
  event: {
    include: {
      sender: true,
      callback: true
    }
  },
  destination: {
    include: {
      currentInstance: {
        include: {
          webhook: true
        }
      }
    }
  }
};

let attemptInclude = {
  intent: {
    include: {
      event: {
        include: {
          sender: true,
          callback: true
        }
      },
      destination: true
    }
  },
  destinationInstance: {
    include: {
      webhook: true
    }
  }
};

let callbackEventInclude = {
  event: {
    include: {
      sender: true,
      callback: true
    }
  },
  callback: true
};

type CallbackDestinationInput = {
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

let callbackSenderPromise: ReturnType<typeof senderService.upsertSender> | null = null;

let getCallbackSender = () => {
  if (!callbackSenderPromise) {
    callbackSenderPromise = senderService
      .upsertSender({ input: CALLBACK_SENDER })
      .catch(error => {
        callbackSenderPromise = null;
        throw error;
      });
  }

  return callbackSenderPromise;
};

let prepareCallbackEventPayloadForDb = (
  type: 'input' | 'output',
  payloadJson?: string | null
) => {
  if (payloadJson === undefined) return {};

  return type === 'input'
    ? { inputJson: payloadJson, inputStorageKey: null }
    : { outputJson: payloadJson, outputStorageKey: null };
};

let enqueueCallbackEventPayloadOffload = async (
  callbackEvent: Pick<CallbackEvent, 'id' | 'inputJson' | 'outputJson'>
) => {
  let jobs: {
    callbackEventId: string;
    payloadType: 'input' | 'output';
    payloadHash: string;
  }[] = [];

  if (callbackEvent.inputJson !== null) {
    jobs.push({
      callbackEventId: callbackEvent.id,
      payloadType: 'input',
      payloadHash: await Hash.sha256(callbackEvent.inputJson)
    });
  }

  if (callbackEvent.outputJson !== null) {
    jobs.push({
      callbackEventId: callbackEvent.id,
      payloadType: 'output',
      payloadHash: await Hash.sha256(callbackEvent.outputJson)
    });
  }

  if (!jobs.length) return;

  await offloadCallbackEventPayloadQueue.addMany(jobs);
};

class callbackServiceImpl {
  private async upsertCallbackDestination(
    prisma: Parameters<Parameters<typeof db.$transaction>[0]>[0],
    d: {
      input: CallbackDestinationInput;
      tenant: Tenant;
      sender: Awaited<ReturnType<typeof senderService.upsertSender>>;
    }
  ) {
    let existing = await prisma.eventDestination.findFirst({
      where: {
        externalId: d.input.externalId,
        tenantOid: d.tenant.oid
      },
      include: {
        currentInstance: {
          include: {
            webhook: true
          }
        }
      }
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
          senderOid: d.sender.oid
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
        include: {
          currentInstance: {
            include: {
              webhook: true
            }
          }
        }
      });
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
        senderOid: d.sender.oid,
        name: d.input.name,
        description: d.input.description,
        eventTypes: d.input.eventTypes ?? [],
        hasEventTypesFilter: !!d.input.eventTypes?.length,
        retryType: d.input.retry?.type,
        retryDelaySeconds: d.input.retry?.delaySeconds,
        retryMaxAttempts: d.input.retry?.maxAttempts,
        currentInstanceOid: instance.oid
      },
      include: {
        currentInstance: {
          include: {
            webhook: true
          }
        }
      }
    });
  }

  async upsertCallback(d: {
    input: {
      callbackId: string;
      name: string;
      description?: string | null;
      eventTypes?: string[] | null;
      destinations: CallbackDestinationInput[];
    };
    tenant: Tenant;
  }) {
    let sender = await getCallbackSender();

    return await db.$transaction(async prisma => {
      let destinations = [];
      for (let destination of d.input.destinations) {
        destinations.push(
          await this.upsertCallbackDestination(prisma, {
            tenant: d.tenant,
            sender,
            input: destination
          })
        );
      }

      let eventTypes = d.input.eventTypes ?? [];
      let callback = await prisma.callback.upsert({
        where: { id: d.input.callbackId },
        update: {
          status: 'active',
          name: d.input.name,
          description: d.input.description ?? null,
          eventTypes,
          hasEventTypesFilter: eventTypes.length > 0,
          senderOid: sender.oid,
          archivedAt: null
        },
        create: {
          oid: snowflake.nextId(),
          id: d.input.callbackId,
          status: 'active',
          name: d.input.name,
          description: d.input.description ?? null,
          eventTypes,
          hasEventTypesFilter: eventTypes.length > 0,
          tenantOid: d.tenant.oid,
          senderOid: sender.oid
        }
      });

      let destinationOids = destinations.map(destination => destination.oid);

      if (destinationOids.length) {
        await prisma.callbackDestinationLink.createMany({
          skipDuplicates: true,
          data: destinationOids.map(destinationOid => ({
            oid: snowflake.nextId(),
            callbackOid: callback.oid,
            eventDestinationOid: destinationOid,
            status: 'active'
          }))
        });

        await prisma.callbackDestinationLink.updateMany({
          where: {
            callbackOid: callback.oid,
            eventDestinationOid: { in: destinationOids }
          },
          data: { status: 'active' }
        });
      }

      await prisma.callbackDestinationLink.updateMany({
        where: {
          callbackOid: callback.oid,
          eventDestinationOid: destinationOids.length ? { notIn: destinationOids } : undefined
        },
        data: { status: 'inactive' }
      });

      return await prisma.callback.findFirstOrThrow({
        where: { oid: callback.oid },
        include: callbackInclude
      });
    });
  }

  async archiveCallback(d: { callback: Callback }) {
    return await db.callback.update({
      where: { oid: d.callback.oid },
      data: {
        status: 'archived',
        archivedAt: new Date(),
        destinations: {
          updateMany: {
            where: { status: 'active' },
            data: { status: 'inactive' }
          }
        }
      },
      include: callbackInclude
    });
  }

  async getCallbackById(d: { id: string; tenant: Tenant }) {
    let callback = await db.callback.findFirst({
      where: {
        id: d.id,
        tenantOid: d.tenant.oid
      },
      include: callbackInclude
    });
    if (!callback) throw new ServiceError(notFoundError('callback'));
    return callback;
  }

  async recordCallbackEvent(d: {
    callback: Callback & {
      destinations: {
        status: 'active' | 'inactive';
        eventDestination: { id: string; status: 'active' | 'inactive' };
      }[];
    };
    tenant: Tenant;
    input: {
      eventId?: string | null;
      callbackInstanceId?: string | null;
      sourceId?: string | null;
      triggerId?: string | null;
      triggerKey?: string | null;
      status?: CallbackEventStatus;
      eventType: string;
      deliveryPayloadJson?: string | null;
      inputJson?: string | null;
      outputJson?: string | null;
      errorCode?: string | null;
      errorMessage?: string | null;
      createdAt?: Date;
    };
  }) {
    let sender = await getCallbackSender();

    let externalId = d.input.eventId ?? null;
    let generatedCallbackEventId = getId('callbackEvent').id;
    let idempotencySourceId = externalId ?? generatedCallbackEventId;
    let status = d.input.status ?? 'succeeded';
    let idempotencyKey = await Hash.sha256(
      canonicalize(['callback-event', d.callback.id, idempotencySourceId])
    );

    let existing = await db.callbackEvent.findFirst({
      where: {
        idempotencyKey,
        callbackOid: d.callback.oid,
        callback: { tenantOid: d.tenant.oid }
      },
      include: callbackEventInclude
    });

    let shouldDeliver =
      d.callback.status === 'active' &&
      (!d.callback.hasEventTypesFilter || d.callback.eventTypes.includes(d.input.eventType));
    let destinationIds = shouldDeliver
      ? d.callback.destinations
          .filter(
            link => link.status === 'active' && link.eventDestination.status === 'active'
          )
          .map(link => link.eventDestination.id)
      : [];

    let callbackEventIdentity = {
      oid: existing?.oid ?? snowflake.nextId(),
      id: existing?.id?.startsWith('cbe_') ? existing.id : generatedCallbackEventId
    };

    let inputPayload = prepareCallbackEventPayloadForDb('input', d.input.inputJson);
    let outputPayload = prepareCallbackEventPayloadForDb('output', d.input.outputJson);

    let callbackEvent = await db.$transaction(async prisma => {
      let eventOid = existing?.eventOid ?? null;

      if (status === 'succeeded' && !eventOid) {
        if (!d.input.deliveryPayloadJson) {
          throw new ServiceError(
            badRequestError({
              code: 'delivery_payload_required',
              message:
                'deliveryPayloadJson is required when callback event status is succeeded.'
            })
          );
        }

        let event = await prisma.event.create({
          data: {
            ...getId('event'),
            idempotencyKey,

            status: 'pending',

            topics: [
              `callback:${d.callback.id}`,
              ...(d.input.callbackInstanceId
                ? [`callback_instance:${d.input.callbackInstanceId}`]
                : []),
              ...(d.input.triggerId ? [`callback_trigger:${d.input.triggerId}`] : [])
            ],
            eventType: d.input.eventType,
            payloadJson: d.input.deliveryPayloadJson,
            headers: Object.entries({
              'metorial-callback-id': d.callback.id,
              ...(d.input.callbackInstanceId
                ? { 'metorial-callback-instance-id': d.input.callbackInstanceId }
                : {})
            }),

            onlyForDestinations: destinationIds,
            hasOnlyForDestinationsFilter: !!destinationIds,

            deliveryDestinationCount: -1,
            deliveryFailureCount: 0,
            deliverySuccessCount: 0,

            senderOid: sender.oid,
            tenantOid: d.tenant.oid,

            callbackOid: d.callback.oid,
            callbackInstanceId: d.input.callbackInstanceId,
            callbackSourceId: d.input.sourceId,
            callbackTriggerId: d.input.triggerId
          }
        });

        eventOid = event.oid;
      }

      return await prisma.callbackEvent.upsert({
        where: { idempotencyKey },
        update: {
          id: callbackEventIdentity.id,
          status,
          externalId,
          eventOid,
          type: d.input.eventType,
          sourceId: d.input.sourceId,
          triggerId: d.input.triggerId,
          triggerKey: d.input.triggerKey,
          callbackInstanceId: d.input.callbackInstanceId,
          errorCode: d.input.errorCode ?? null,
          errorMessage: d.input.errorMessage ?? null,
          ...inputPayload,
          ...outputPayload
        },
        create: {
          ...callbackEventIdentity,
          idempotencyKey,
          externalId,
          status,
          callbackOid: d.callback.oid,
          eventOid,
          type: d.input.eventType,
          sourceId: d.input.sourceId,
          triggerId: d.input.triggerId,
          triggerKey: d.input.triggerKey,
          callbackInstanceId: d.input.callbackInstanceId,
          errorCode: d.input.errorCode,
          errorMessage: d.input.errorMessage,
          ...inputPayload,
          ...outputPayload,
          createdAt: d.input.createdAt
        },
        include: callbackEventInclude
      });
    });

    if (status === 'succeeded' && callbackEvent.event) {
      await newEventQueue.add({ eventId: callbackEvent.event.id });
    }

    await enqueueCallbackEventPayloadOffload(callbackEvent);

    return callbackEvent;
  }

  async listCallbackEvents(d: {
    tenant: Tenant;
    callback: Callback;
    eventTypes?: string[];
    callbackInstanceIds?: string[];
  }) {
    return Paginator.create(({ prisma }) =>
      prisma(async opts =>
        db.callbackEvent.findMany({
          ...opts,
          where: {
            callbackOid: d.callback.oid,
            callback: { tenantOid: d.tenant.oid },
            type: d.eventTypes ? { in: d.eventTypes } : undefined,
            callbackInstanceId: d.callbackInstanceIds
              ? { in: d.callbackInstanceIds }
              : undefined
          },
          include: callbackEventInclude
        })
      )
    );
  }

  async listCallbackEventsByIds(d: { tenant: Tenant; callbackEventIds: string[] }) {
    if (d.callbackEventIds.length === 0) return [];

    return await db.callbackEvent.findMany({
      where: {
        id: { in: d.callbackEventIds },
        callback: { tenantOid: d.tenant.oid }
      },
      include: callbackEventInclude
    });
  }

  async getCallbackEvent(d: { tenant: Tenant; callback: Callback; callbackEventId: string }) {
    let event = await db.callbackEvent.findFirst({
      where: {
        id: d.callbackEventId,
        callbackOid: d.callback.oid,
        callback: { tenantOid: d.tenant.oid }
      },
      include: callbackEventInclude
    });
    if (!event) throw new ServiceError(notFoundError('callback.event'));
    return event;
  }

  async listCallbackDeliveryIntents(d: {
    tenant: Tenant;
    callback: Callback;
    status?: EventDeliveryIntentStatus[];
    destinationIds?: string[];
  }) {
    return Paginator.create(({ prisma }) =>
      prisma(async opts =>
        db.eventDeliveryIntent.findMany({
          ...opts,
          where: {
            event: {
              tenantOid: d.tenant.oid,
              callbackOid: d.callback.oid
            },
            status: d.status ? { in: d.status } : undefined,
            destination: d.destinationIds
              ? {
                  OR: [
                    { id: { in: d.destinationIds } },
                    { externalId: { in: d.destinationIds } }
                  ]
                }
              : undefined
          },
          include: intentInclude
        })
      )
    );
  }

  async getCallbackDeliveryIntent(d: {
    tenant: Tenant;
    callback: Callback;
    eventDeliveryIntentId: string;
  }) {
    let intent = await db.eventDeliveryIntent.findFirst({
      where: {
        id: d.eventDeliveryIntentId,
        event: {
          tenantOid: d.tenant.oid,
          callbackOid: d.callback.oid
        }
      },
      include: intentInclude
    });
    if (!intent) throw new ServiceError(notFoundError('callback.delivery_intent'));
    return intent;
  }

  async listCallbackDeliveryAttempts(d: {
    tenant: Tenant;
    callback: Callback;
    status?: EventDeliveryAttemptStatus[];
    destinationIds?: string[];
  }) {
    return Paginator.create(({ prisma }) =>
      prisma(async opts =>
        db.eventDeliveryAttempt.findMany({
          ...opts,
          where: {
            intent: {
              event: {
                tenantOid: d.tenant.oid,
                callbackOid: d.callback.oid
              },
              destination: d.destinationIds
                ? {
                    OR: [
                      { id: { in: d.destinationIds } },
                      { externalId: { in: d.destinationIds } }
                    ]
                  }
                : undefined
            },
            status: d.status ? { in: d.status } : undefined
          },
          include: attemptInclude
        })
      )
    );
  }

  async getCallbackDeliveryAttempt(d: {
    tenant: Tenant;
    callback: Callback;
    eventDeliveryAttemptId: string;
  }) {
    let attempt = await db.eventDeliveryAttempt.findFirst({
      where: {
        id: d.eventDeliveryAttemptId,
        intent: {
          event: {
            tenantOid: d.tenant.oid,
            callbackOid: d.callback.oid
          }
        }
      },
      include: attemptInclude
    });
    if (!attempt) throw new ServiceError(notFoundError('callback.delivery_attempt'));
    return attempt;
  }
}

export let callbackService = Service.create(
  'callbackService',
  () => new callbackServiceImpl()
).build();
