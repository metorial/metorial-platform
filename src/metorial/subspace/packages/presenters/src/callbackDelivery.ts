import type { createSignalClient } from '@metorial-platform-systems/signal-client';

type SignalClient = ReturnType<typeof createSignalClient>;

type CallbackDelivery = Awaited<ReturnType<SignalClient['callback']['getDelivery']>>;
type CallbackDeliveryList = Awaited<ReturnType<SignalClient['callback']['listDeliveries']>>;
type CallbackDeliveryAttempt = Awaited<
  ReturnType<SignalClient['callback']['getDeliveryAttempt']>
>;
type CallbackDeliveryAttemptList = Awaited<
  ReturnType<SignalClient['callback']['listDeliveryAttempts']>
>;
type CallbackDeliveryEmbeddedAttempt = NonNullable<CallbackDelivery['attempts']>[number];

let presentDestination = (destination: CallbackDelivery['destination']) => ({
  object: 'callback.delivery.destination',

  id: destination.id,
  name: destination.name,
  description: destination.description,
  type: destination.type,
  eventTypes: destination.eventTypes,

  retry: destination.retry,
  webhook: destination.webhook
    ? {
        id: destination.webhook.id,
        url: destination.webhook.url,
        method: destination.webhook.method,
        createdAt: destination.webhook.createdAt
      }
    : null,

  createdAt: destination.createdAt,
  updatedAt: destination.updatedAt
});

let presentEvent = (event: CallbackDelivery['event']) => ({
  object: 'callback.delivery.event',

  id: event.id,
  type: event.type,
  topics: event.topics,
  status: event.status,
  destinationCount: event.destinationCount,
  successCount: event.successCount,
  failureCount: event.failureCount,
  request: event.request,

  createdAt: event.createdAt,
  updatedAt: event.updatedAt
});

let presentAttempt = (attempt: CallbackDeliveryEmbeddedAttempt) => ({
  object: 'callback.delivery_attempt',

  id: attempt.id,
  status: attempt.status,
  attemptNumber: attempt.attemptNumber,
  durationMs: attempt.durationMs,
  error: attempt.error,
  response: attempt.response,

  createdAt: attempt.createdAt,
  startedAt: attempt.startedAt,
  completedAt: attempt.completedAt
});

export let callbackDeliveryPresenter = (delivery: CallbackDelivery) => ({
  object: 'callback.delivery',

  id: delivery.id,
  status: delivery.status,
  error: delivery.error,
  attemptCount: delivery.attemptCount,

  event: presentEvent(delivery.event),
  destination: presentDestination(delivery.destination),
  attempts: delivery.attempts ? delivery.attempts.map(presentAttempt) : null,

  createdAt: delivery.createdAt,
  updatedAt: delivery.updatedAt,
  lastAttemptAt: delivery.lastAttemptAt,
  nextAttemptAt: delivery.nextAttemptAt
});

export let callbackDeliveryListPresenter = (result: CallbackDeliveryList) => ({
  items: result.items.map(callbackDeliveryPresenter),
  pagination: result.pagination
});

export let callbackDeliveryAttemptPresenter = (attempt: CallbackDeliveryAttempt) => ({
  object: 'callback.delivery_attempt',

  id: attempt.id,
  status: attempt.status,
  attemptNumber: attempt.attemptNumber,
  durationMs: attempt.durationMs,
  error: attempt.error,
  response: attempt.response,

  intent: callbackDeliveryPresenter(attempt.intent),

  createdAt: attempt.createdAt,
  startedAt: attempt.startedAt,
  completedAt: attempt.completedAt
});

export let callbackDeliveryAttemptListPresenter = (result: CallbackDeliveryAttemptList) => ({
  items: result.items.map(callbackDeliveryAttemptPresenter),
  pagination: result.pagination
});
