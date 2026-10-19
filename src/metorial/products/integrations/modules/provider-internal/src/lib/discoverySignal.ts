import { delay } from '@lowerdeck/delay';
import { createRedisClient } from '@lowerdeck/redis';
import { env } from '../env';

export type DiscoveryKind = 'pairVersion' | 'providerVersion';

let channel = 'sub:pint:disc';
let markerTtlSeconds = 60 * 10;
let fallbackPollIntervalMs = 500;
let markerRecheckDelayMs = 10_000;
let markerRecheckIntervalMs = 5_000;

let publisherFactory = createRedisClient({ redisUrl: env.service.REDIS_URL });
let subscriberFactory = createRedisClient({ redisUrl: env.service.REDIS_URL });

let publisherPromise: Promise<any> | undefined;
let subscriptionPromise: Promise<void> | undefined;

let waiters = new Map<string, Set<() => void>>();

export let getDiscoveryMarkerKey = (kind: DiscoveryKind, oid: bigint) =>
  `${channel}:${kind}:${oid}`;

let getPublisher = async () => {
  publisherPromise ??= publisherFactory.eager().catch(error => {
    publisherPromise = undefined;
    throw error;
  });

  return await publisherPromise;
};

let notifyWaiters = (key: string) => {
  let resolvers = waiters.get(key);
  if (!resolvers) return;

  waiters.delete(key);
  for (let resolve of resolvers) resolve();
};

let ensureSubscribed = async () => {
  subscriptionPromise ??= (async () => {
    let subscriber = await subscriberFactory.eager();
    await subscriber.subscribe(channel, (key: string) => notifyWaiters(key));
  })().catch(error => {
    subscriptionPromise = undefined;
    throw error;
  });

  await subscriptionPromise;
};

export let markDiscoveryFinished = async (d: {
  kind: DiscoveryKind;
  oid: bigint;
  status: string;
}) => {
  let key = getDiscoveryMarkerKey(d.kind, d.oid);

  try {
    let publisher = await getPublisher();
    await publisher.set(key, d.status, { EX: markerTtlSeconds });
    await publisher.publish(channel, key);
  } catch (error) {
    console.error('Failed to signal discovery completion', error);
  }
};

let pollUntilFinished = async (d: {
  isFinished: () => Promise<boolean>;
  deadline: number;
}) => {
  while (Date.now() < d.deadline) {
    await delay(Math.min(fallbackPollIntervalMs, Math.max(0, d.deadline - Date.now())));
    if (await d.isFinished()) return;
  }
};

/**
 * Resolves once discovery for the record has finished, or when the timeout elapses. Callers
 * re-read the record afterwards either way. The waiter is registered before the marker is read,
 * so a completion published between the two is not missed. If Redis is unavailable this falls
 * back to polling `isFinished`.
 */
export let waitForDiscovery = async (d: {
  kind: DiscoveryKind;
  oid: bigint;
  timeoutMs: number;
  isFinished: () => Promise<boolean>;
}) => {
  let key = getDiscoveryMarkerKey(d.kind, d.oid);
  let deadline = Date.now() + d.timeoutMs;

  let resolveFinished!: () => void;
  let finished = new Promise<void>(resolve => (resolveFinished = resolve));

  let resolvers = waiters.get(key) ?? new Set();
  resolvers.add(resolveFinished);
  waiters.set(key, resolvers);

  let timeout: ReturnType<typeof setTimeout> | undefined;
  let timedOut = new Promise<void>(resolve => {
    timeout = setTimeout(resolve, d.timeoutMs);
  });

  let settled = false;

  // Pub/sub messages published while the subscriber is reconnecting are lost, so long waits
  // also re-check the marker now and then.
  let recheckMarker = async (publisher: any) => {
    await delay(markerRecheckDelayMs);

    while (!settled) {
      if (await publisher.get(key)) return;
      await delay(markerRecheckIntervalMs);
    }
  };

  let waitForSignal = async () => {
    await ensureSubscribed();

    let publisher = await getPublisher();
    if (await publisher.get(key)) return;

    await Promise.race([finished, recheckMarker(publisher)]);
  };

  try {
    await Promise.race([waitForSignal(), timedOut]);
  } catch (error) {
    console.error('Discovery signal unavailable, falling back to polling', error);
    await pollUntilFinished({ isFinished: d.isFinished, deadline });
  } finally {
    settled = true;
    if (timeout) clearTimeout(timeout);

    let current = waiters.get(key);
    current?.delete(resolveFinished);
    if (current?.size === 0) waiters.delete(key);
  }
};
