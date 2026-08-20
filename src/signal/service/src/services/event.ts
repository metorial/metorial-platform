import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  AmbiguousCanonicalHeadersError,
  computeIdempotentEventRequestFingerprintV1,
  normalizeIdempotentEventDestinations,
  normalizeIdempotentEventHeaders,
  normalizeIdempotentEventTopics
} from '@metorial-platform-systems/signal-protocol';
import type { Callback, Event, Sender, Tenant } from '../../prisma/generated/client';
import { db } from '../db';
import { env } from '../env';
import { getId } from '../id';
import { storageKey } from '../lib/storageKey';
import { newEventQueue } from '../queues/send/init';
import { storage } from '../storage';

let include = { sender: true, callback: true, tenant: true };

export type IdempotentEventCreateInput = {
  idempotencyKey: string;
  topics: string[];
  eventType: string;
  payloadJson: string;
  headers: Record<string, string>;
  onlyForDestinations?: string[];
  callbackInstanceId?: string | null;
  callbackSourceId?: string | null;
  callbackTriggerId?: string | null;
};

let withCanonicalHeadersServiceError = <T>(operation: () => T): T => {
  try {
    return operation();
  } catch (error) {
    if (error instanceof AmbiguousCanonicalHeadersError) {
      throw new ServiceError(
        badRequestError({
          code: 'invalid_canonical_headers',
          message: 'Signal event headers are not canonical.'
        })
      );
    }
    throw error;
  }
};

export let normalizeEventTopics = (topics: readonly string[]) =>
  normalizeIdempotentEventTopics(topics);

export let normalizeEventDestinations = (destinations: readonly string[] | undefined) =>
  normalizeIdempotentEventDestinations(destinations);

export let normalizeEventHeaders = (headers: Readonly<Record<string, string>>) =>
  withCanonicalHeadersServiceError(() => normalizeIdempotentEventHeaders(headers));

export let computeIdempotentEventRequestFingerprint = (d: {
  tenantId: string;
  senderId: string;
  callbackId?: string | null;
  input: IdempotentEventCreateInput;
}) =>
  withCanonicalHeadersServiceError(() =>
    computeIdempotentEventRequestFingerprintV1({
      tenantId: d.tenantId,
      senderId: d.senderId,
      topics: d.input.topics,
      eventType: d.input.eventType,
      payloadJson: d.input.payloadJson,
      headers: d.input.headers,
      onlyForDestinations: d.input.onlyForDestinations,
      callbackId: d.callbackId,
      callbackInstanceId: d.input.callbackInstanceId,
      callbackSourceId: d.input.callbackSourceId,
      callbackTriggerId: d.input.callbackTriggerId
    })
  );

type StoredIdempotentEvent = Event & {
  tenant: Tenant;
  sender: Sender;
  callback: Callback | null;
};

export let computeStoredIdempotentEventRequestFingerprint = async (
  event: StoredIdempotentEvent,
  dependencies: {
    readOffloadedPayload?: () => Promise<{ body: string; headers: [string, string][] }>;
  } = {}
) => {
  if (!event.idempotencyKey) throw new Error('Signal event has no idempotency key');
  let payload =
    event.payloadJson !== null
      ? {
          body: event.payloadJson,
          headers: event.headers as [string, string][]
        }
      : await (
          dependencies.readOffloadedPayload ??
          (async () => {
            let stored = await storage.getObject(
              env.storage.LOGS_BUCKET_NAME,
              storageKey.event(event)
            );
            let parsed = JSON.parse(stored.data.toString('utf8')) as {
              body?: unknown;
              headers?: unknown;
            };
            if (
              typeof parsed.body !== 'string' ||
              !Array.isArray(parsed.headers) ||
              parsed.headers.some(
                header =>
                  !Array.isArray(header) ||
                  header.length !== 2 ||
                  typeof header[0] !== 'string' ||
                  typeof header[1] !== 'string'
              )
            ) {
              throw new Error('Stored Signal event payload is invalid');
            }
            return { body: parsed.body, headers: parsed.headers as [string, string][] };
          })
        )();
  return computeIdempotentEventRequestFingerprint({
    tenantId: event.tenant.id,
    senderId: event.sender.id,
    callbackId: event.callback?.id,
    input: {
      idempotencyKey: event.idempotencyKey,
      topics: event.topics,
      eventType: event.eventType,
      payloadJson: payload.body,
      headers: Object.fromEntries(payload.headers),
      onlyForDestinations: event.hasOnlyForDestinationsFilter
        ? event.onlyForDestinations
        : undefined,
      callbackInstanceId: event.callbackInstanceId,
      callbackSourceId: event.callbackSourceId,
      callbackTriggerId: event.callbackTriggerId
    }
  });
};

let isUniqueConflict = (error: unknown) =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';

export let ensureEventInitializationEnqueued = async (
  event: {
    id: string;
    initializationStatus: 'awaiting_enqueue' | 'queued' | 'initialized';
  },
  dependencies: {
    enqueue?: typeof newEventQueue.add;
    store?: typeof db;
  } = {}
) => {
  if (event.initializationStatus === 'initialized') return;
  try {
    await (dependencies.enqueue ?? newEventQueue.add)({ eventId: event.id }, { id: event.id });
    await (dependencies.store ?? db).event.updateMany({
      where: { id: event.id, initializationStatus: { not: 'initialized' } },
      data: { initializationStatus: 'queued', initializationEnqueuedAt: new Date() }
    });
  } catch {
    // The committed marker is repaired periodically; never undo or duplicate the Event row.
    console.error('Signal event initialization enqueue failed', {
      eventId: event.id,
      safeErrorCode: 'event_initialization_enqueue_failed'
    });
  }
};

export class eventServiceImpl {
  constructor(
    private readonly store: typeof db = db,
    private readonly enqueueInitialization: typeof ensureEventInitializationEnqueued = ensureEventInitializationEnqueued
  ) {}

  async createEvent(d: {
    input: {
      idempotencyKey?: string;
      topics: string[];
      eventType: string;
      payloadJson: string;
      headers: Record<string, string>;
      onlyForDestinations?: string[];
    };
    sender: Sender;
    tenant: Tenant;
    callback?: Callback;
    callbackInstanceId?: string | null;
    callbackSourceId?: string | null;
    callbackTriggerId?: string | null;
  }) {
    if (d.input.idempotencyKey) {
      return await this.createIdempotentEvent({
        tenant: d.tenant,
        sender: d.sender,
        callback: d.callback,
        input: {
          ...d.input,
          idempotencyKey: d.input.idempotencyKey,
          callbackInstanceId: d.callbackInstanceId,
          callbackSourceId: d.callbackSourceId,
          callbackTriggerId: d.callbackTriggerId
        }
      });
    }
    let normalizedHeaders = normalizeEventHeaders(d.input.headers);
    let event = await this.store.event.create({
      data: {
        ...getId('event'),
        status: 'pending',
        topics: normalizeEventTopics(d.input.topics),
        eventType: d.input.eventType,
        payloadJson: d.input.payloadJson,
        headers: Object.entries(normalizedHeaders),
        onlyForDestinations: normalizeEventDestinations(d.input.onlyForDestinations),
        hasOnlyForDestinationsFilter: d.input.onlyForDestinations !== undefined,
        deliveryDestinationCount: -1,
        deliveryFailureCount: 0,
        deliverySuccessCount: 0,
        senderOid: d.sender.oid,
        tenantOid: d.tenant.oid,
        callbackOid: d.callback?.oid,
        callbackInstanceId: d.callbackInstanceId,
        callbackSourceId: d.callbackSourceId,
        callbackTriggerId: d.callbackTriggerId
      },
      include
    });
    await this.enqueueInitialization(event);
    return event;
  }

  async createIdempotentEvent(d: {
    input: IdempotentEventCreateInput;
    sender: Sender;
    tenant: Tenant;
    callback?: Callback;
  }) {
    let requestFingerprint = computeIdempotentEventRequestFingerprint({
      tenantId: d.tenant.id,
      senderId: d.sender.id,
      callbackId: d.callback?.id,
      input: d.input
    });
    let resolveExisting = async () => {
      let existing = await this.store.event.findUnique({
        where: { idempotencyKey: d.input.idempotencyKey },
        include
      });
      if (existing?.idempotencyKey && existing.requestFingerprint === null) {
        let repairedFingerprint =
          await computeStoredIdempotentEventRequestFingerprint(existing);
        let repaired = await this.store.event.updateMany({
          where: {
            oid: existing.oid,
            idempotencyKey: existing.idempotencyKey,
            requestFingerprint: null
          },
          data: { requestFingerprint: repairedFingerprint }
        });
        if (repaired.count === 1) {
          existing = { ...existing, requestFingerprint: repairedFingerprint };
        } else {
          existing = await this.store.event.findUnique({
            where: { idempotencyKey: d.input.idempotencyKey },
            include
          });
        }
      }
      if (
        !existing ||
        existing.tenantOid !== d.tenant.oid ||
        existing.senderOid !== d.sender.oid ||
        existing.requestFingerprint !== requestFingerprint
      ) {
        throw new ServiceError(
          badRequestError({
            code: 'idempotency_payload_conflict',
            message: 'The Signal idempotency key is already bound to another request.'
          })
        );
      }
      await this.enqueueInitialization(existing);
      return existing;
    };

    if (
      await this.store.event.findUnique({
        where: { idempotencyKey: d.input.idempotencyKey },
        select: { oid: true }
      })
    ) {
      return await resolveExisting();
    }
    try {
      let normalizedHeaders = normalizeEventHeaders(d.input.headers);
      let event = await this.store.event.create({
        data: {
          ...getId('event'),
          idempotencyKey: d.input.idempotencyKey,
          requestFingerprint,
          initializationStatus: 'awaiting_enqueue',
          status: 'pending',
          topics: normalizeEventTopics(d.input.topics),
          eventType: d.input.eventType,
          payloadJson: d.input.payloadJson,
          headers: Object.entries(normalizedHeaders),
          onlyForDestinations: normalizeEventDestinations(d.input.onlyForDestinations),
          hasOnlyForDestinationsFilter: d.input.onlyForDestinations !== undefined,
          deliveryDestinationCount: -1,
          deliveryFailureCount: 0,
          deliverySuccessCount: 0,
          senderOid: d.sender.oid,
          tenantOid: d.tenant.oid,
          callbackOid: d.callback?.oid,
          callbackInstanceId: d.input.callbackInstanceId,
          callbackSourceId: d.input.callbackSourceId,
          callbackTriggerId: d.input.callbackTriggerId
        },
        include
      });
      // The database commit necessarily precedes this queue operation.
      await this.enqueueInitialization(event);
      return event;
    } catch (error) {
      if (isUniqueConflict(error)) return await resolveExisting();
      throw error;
    }
  }

  async repairLegacyIdempotentEventFingerprint(d: { eventId: string }) {
    let event = await this.store.event.findFirst({
      where: { id: d.eventId, idempotencyKey: { not: null } },
      include
    });
    if (!event) throw new ServiceError(notFoundError('event'));
    if (event.requestFingerprint !== null) return event;
    let requestFingerprint = await computeStoredIdempotentEventRequestFingerprint(event);
    let repaired = await this.store.event.updateMany({
      where: {
        oid: event.oid,
        idempotencyKey: event.idempotencyKey,
        requestFingerprint: null
      },
      data: { requestFingerprint }
    });
    if (repaired.count === 1) return { ...event, requestFingerprint };
    return await this.store.event.findUniqueOrThrow({ where: { oid: event.oid }, include });
  }

  async getEventByIdempotencyKey(d: { idempotencyKey: string; tenant: Tenant }) {
    let event = await this.store.event.findFirst({
      where: { idempotencyKey: d.idempotencyKey, tenantOid: d.tenant.oid },
      include
    });
    if (!event) throw new ServiceError(notFoundError('event'));
    if (event.requestFingerprint === null && event.idempotencyKey) {
      return await this.repairLegacyIdempotentEventFingerprint({ eventId: event.id });
    }
    return event;
  }

  async getEventById(d: { id: string; tenant: Tenant }) {
    let event = await this.store.event.findFirst({
      where: { id: d.id, tenantOid: d.tenant.oid },
      include
    });
    if (!event) throw new ServiceError(notFoundError('event'));
    return event;
  }

  async listEvents(d: {
    tenant: Tenant;
    eventTypes?: string[];
    topics?: string[];
    senderIds?: string[];
    callbackId?: string;
  }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await this.store.event.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              eventType: d.eventTypes ? { in: d.eventTypes } : undefined,
              topics: d.topics ? { hasSome: d.topics } : undefined,
              sender: d.senderIds
                ? { OR: [{ id: { in: d.senderIds } }, { identifier: { in: d.senderIds } }] }
                : undefined,
              callback: d.callbackId ? { id: d.callbackId } : undefined
            },
            include
          })
      )
    );
  }
}

export let eventService = Service.create('eventService', () => new eventServiceImpl()).build();
