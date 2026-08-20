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
import { eventService } from './event';
import { senderService } from './sender';
import { webhookDestinationSigningSecretService } from './webhookDestinationSigningSecret';

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
    let ownership = await prisma.eventDestination.findFirst({
      where: { externalId: d.input.externalId },
      select: { tenantOid: true, senderOid: true, isCallbackDestination: true }
    });
    if (
      ownership &&
      (ownership.tenantOid !== d.tenant.oid ||
        ownership.senderOid !== d.sender.oid ||
        !ownership.isCallbackDestination)
    ) {
      throw new ServiceError(
        badRequestError({ message: 'Callback destination ownership is invalid.' })
      );
    }
    let existing = await prisma.eventDestination.findFirst({
      where: {
        externalId: d.input.externalId,
        tenantOid: d.tenant.oid,
        senderOid: d.sender.oid,
        isCallbackDestination: true
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
      let generated =
        await webhookDestinationSigningSecretService.createGeneratedWebhookInTransaction({
          tx: prisma,
          tenant: d.tenant,
          url: d.input.variant.url,
          method: d.input.variant.method
        });
      let webhook = generated.webhook;

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

      let eventDestination = await prisma.eventDestination.update({
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
      return { eventDestination, secretIssuanceReceipt: generated.receipt };
    }

    let webhook;
    let secretIssuanceReceipt;
    if (existing.currentInstance?.webhook) {
      let signingSecret = (
        await webhookDestinationSigningSecretService.resolveActiveAndRetiring({
          tenantOid: d.tenant.oid,
          webhookOid: existing.currentInstance.webhook.oid
        })
      ).find(secret => secret.status === 'active')!.plaintext;
      webhook = await prisma.webhookDestinationWebhook.create({
        data: {
          ...getId('eventDestinationWebhook'),
          url: d.input.variant.url,
          method: d.input.variant.method,
          signingSecret,
          tenantOid: existing.tenantOid
        }
      });
      await webhookDestinationSigningSecretService.createImportedInitialInTransaction({
        tx: prisma,
        tenant: d.tenant,
        webhook,
        plaintext: signingSecret
      });
    } else {
      let generated =
        await webhookDestinationSigningSecretService.createGeneratedWebhookInTransaction({
          tx: prisma,
          tenant: d.tenant,
          url: d.input.variant.url,
          method: d.input.variant.method
        });
      webhook = generated.webhook;
      secretIssuanceReceipt = generated.receipt;
    }

    let instance = await prisma.eventDestinationInstance.create({
      data: {
        oid: snowflake.nextId(),
        type: d.input.variant.type,
        webhookOid: webhook.oid,
        destinationOid: existing.oid
      }
    });

    let eventDestination = await prisma.eventDestination.update({
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
    return { eventDestination, secretIssuanceReceipt };
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
      let destinationResults = [];
      for (let destination of d.input.destinations) {
        destinationResults.push(
          await this.upsertCallbackDestination(prisma, {
            tenant: d.tenant,
            sender,
            input: destination
          })
        );
      }

      let eventTypes = d.input.eventTypes ?? [];
      let callbackOwner = await prisma.callback.findUnique({
        where: { id: d.input.callbackId }
      });
      if (
        callbackOwner &&
        (callbackOwner.tenantOid !== d.tenant.oid || callbackOwner.senderOid !== sender.oid)
      ) {
        throw new ServiceError(badRequestError({ message: 'Callback ownership is invalid.' }));
      }
      let callback = callbackOwner
        ? await prisma.callback.update({
            where: { oid: callbackOwner.oid },
            data: {
              status: 'active',
              name: d.input.name,
              description: d.input.description ?? null,
              eventTypes,
              hasEventTypesFilter: eventTypes.length > 0,
              senderOid: sender.oid,
              archivedAt: null
            }
          })
        : await prisma.callback.create({
            data: {
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

      let destinationOids = destinationResults.map(result => result.eventDestination.oid);

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

      let resolvedCallback = await prisma.callback.findFirstOrThrow({
        where: { oid: callback.oid },
        include: callbackInclude
      });
      return {
        callback: resolvedCallback,
        secretIssuanceReceipts: destinationResults
          .map(result => result.secretIssuanceReceipt)
          .filter(receipt => receipt !== undefined)
      };
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

    let event = null;
    if (status === 'succeeded') {
      if (!d.input.deliveryPayloadJson) {
        throw new ServiceError(
          badRequestError({
            code: 'delivery_payload_required',
            message: 'deliveryPayloadJson is required when callback event status is succeeded.'
          })
        );
      }

      event = await eventService.createEvent({
        input: {
          idempotencyKey,
          topics: [
            `callback:${d.callback.id}`,
            ...(d.input.callbackInstanceId
              ? [`callback_instance:${d.input.callbackInstanceId}`]
              : []),
            ...(d.input.triggerId ? [`callback_trigger:${d.input.triggerId}`] : [])
          ],
          eventType: d.input.eventType,
          payloadJson: d.input.deliveryPayloadJson,
          headers: {
            'metorial-callback-id': d.callback.id,
            ...(d.input.callbackInstanceId
              ? { 'metorial-callback-instance-id': d.input.callbackInstanceId }
              : {})
          },
          // An empty array means this event deliberately has no delivery targets.
          onlyForDestinations: destinationIds
        },
        sender,
        tenant: d.tenant,
        callback: d.callback,
        callbackInstanceId: d.input.callbackInstanceId,
        callbackSourceId: d.input.sourceId,
        callbackTriggerId: d.input.triggerId
      });
    }

    let eventOid = event?.oid ?? existing?.eventOid ?? null;
    let callbackEvent = await db.callbackEvent.upsert({
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

    await enqueueCallbackEventPayloadOffload(callbackEvent);

    return callbackEvent;
  }

  async recordDashboardTestEvent(d: {
    callback: Callback & {
      destinations: {
        status: 'active' | 'inactive';
        eventDestination: { id: string; status: 'active' | 'inactive' };
      }[];
    };
    tenant: Tenant;
    input: {
      eventId: string;
      callbackInstanceId: string;
      eventType: string;
      payloadJson: string;
    };
  }) {
    if (!d.input.eventId.startsWith('dashboard_test:') || d.input.eventId.length <= 15) {
      throw new ServiceError(
        badRequestError({
          code: 'callback_test_event_id_invalid',
          message: 'The callback test event ID is invalid.'
        })
      );
    }

    let eventType = d.input.eventType.trim();
    if (!eventType) {
      throw new ServiceError(
        badRequestError({
          code: 'callback_test_event_type_required',
          message: 'A callback test event type is required.'
        })
      );
    }

    try {
      let payload = JSON.parse(d.input.payloadJson);
      if (!payload || Array.isArray(payload) || typeof payload !== 'object') {
        throw new Error('not an object');
      }
    } catch {
      throw new ServiceError(
        badRequestError({
          code: 'callback_test_payload_invalid',
          message: 'The callback test payload must be a JSON object.'
        })
      );
    }

    return await this.recordCallbackEvent({
      tenant: d.tenant,
      callback: d.callback,
      input: {
        eventId: d.input.eventId,
        callbackInstanceId: d.input.callbackInstanceId,
        sourceId: 'dashboard_test',
        triggerKey: 'dashboard_test',
        status: 'succeeded',
        eventType,
        deliveryPayloadJson: d.input.payloadJson,
        inputJson: d.input.payloadJson,
        outputJson: d.input.payloadJson
      }
    });
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
