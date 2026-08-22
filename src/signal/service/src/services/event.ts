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
import type { Callback, EventStatus, Sender, Tenant } from '../../prisma/generated/client';
import { db } from '../db';
import { getId } from '../id';
import { newEventQueue } from '../queues/send/init';

let include = {
  sender: true,
  callback: true
};

export type IdempotentEventCreateInput = {
  idempotencyKey: string;
  scopeId?: string;
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

let idempotencyConflict = () =>
  new ServiceError(
    badRequestError({
      code: 'idempotency_payload_conflict',
      message: 'The Signal idempotency key is already bound to another request.'
    })
  );

let resolveEventScopeId = (d: { callback?: Callback; scopeId?: string }) => {
  if (d.callback) {
    if (d.scopeId !== undefined && d.scopeId !== d.callback.scopeId) {
      throw new ServiceError(
        badRequestError({
          code: 'event_scope_mismatch',
          message: 'The Signal event scope does not match the callback scope.'
        })
      );
    }
    return d.callback.scopeId;
  }

  if (!d.scopeId) {
    throw new ServiceError(
      badRequestError({
        code: 'event_scope_required',
        message: 'A Signal event scope is required.'
      })
    );
  }

  return d.scopeId;
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
      scopeId: d.input.scopeId,
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
      data: { initializationStatus: 'queued' }
    });
  } catch {
    // The committed awaiting_enqueue marker is durable. Periodic repair will retry this
    // database-to-queue boundary with the same job ID without duplicating the Event row.
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
      scopeId?: string;
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
    let scopeId = resolveEventScopeId({ callback: d.callback, scopeId: d.input.scopeId });

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

    let event = await this.store.event.create({
      data: {
        ...getId('event'),
        initializationStatus: 'awaiting_enqueue',
        status: 'pending',
        scopeId,
        topics: normalizeEventTopics(d.input.topics),
        eventType: d.input.eventType,
        payloadJson: d.input.payloadJson,
        headers: Object.entries(normalizeEventHeaders(d.input.headers)),
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
    let scopeId = resolveEventScopeId({ callback: d.callback, scopeId: d.input.scopeId });
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
      if (
        !existing ||
        existing.tenantOid !== d.tenant.oid ||
        existing.senderOid !== d.sender.oid ||
        existing.scopeId !== scopeId ||
        existing.requestFingerprint !== requestFingerprint
      ) {
        throw idempotencyConflict();
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
          scopeId,
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

      await this.enqueueInitialization(event);
      return event;
    } catch (error) {
      if (isUniqueConflict(error)) return await resolveExisting();
      throw error;
    }
  }

  async getEventByIdempotencyKey(d: { idempotencyKey: string; tenant: Tenant }) {
    let event = await this.store.event.findFirst({
      where: { idempotencyKey: d.idempotencyKey, tenantOid: d.tenant.oid },
      include
    });
    if (!event) throw new ServiceError(notFoundError('event'));
    if (event.requestFingerprint === null) throw idempotencyConflict();
    return event;
  }

  async getEventById(d: { id: string; tenant: Tenant }) {
    let event = await this.store.event.findFirst({
      where: {
        id: d.id,
        tenantOid: d.tenant.oid
      },
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
    scopeIds?: string[];
    callbackIds?: string[];
    statuses?: EventStatus[];
    destinationIds?: string[];
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
              scopeId: d.scopeIds !== undefined ? { in: d.scopeIds } : undefined,
              callback:
                d.callbackIds !== undefined ? { id: { in: d.callbackIds } } : undefined,
              status: d.statuses ? { in: d.statuses } : undefined,
              intents:
                d.destinationIds !== undefined
                  ? { some: { destination: { id: { in: d.destinationIds } } } }
                  : undefined
            },
            include
          })
      )
    );
  }
}

export let eventService = Service.create('eventService', () => new eventServiceImpl()).build();
