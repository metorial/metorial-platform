import {
  type ConduitResponse,
  type ICoordinationAdapter,
  type Sender,
  isConduitHealthPong
} from '@metorial-subspace/conduit';
import type {
  ConduitHeartbeatPing,
  ConduitHeartbeatPong
} from '@metorial-subspace/connection-utils';
import { topics } from '../lib/topic';

let HEARTBEAT_TIMEOUT_MS = 1500;

let FLEET_STARTUP_GRACE_MS = 15000;

let FLEET_FAILURE_THRESHOLD = 3;

let isFleetHealthEnabled = () => {
  let v = process.env.CONDUIT_FLEET_HEALTH;
  return v === '1' || v === 'true' || v === 'yes';
};

export class ConduitHeartbeatError extends Error {
  originalError?: Error;

  constructor(message: string, originalError?: Error) {
    super(message);
    this.name = 'ConduitHeartbeatError';
    this.originalError = originalError;
  }
}

export interface ConduitHeartbeatSender {
  send(topic: string, payload: unknown, timeout?: number): Promise<ConduitResponse>;
}

export interface CheckConduitHeartbeatOpts {
  sender?: ConduitHeartbeatSender;
  timeoutMs?: number;
  now?: () => number;
  id?: string;
  /**
   * Whether a totally empty fleet (no active receivers) should fail the check.
   *
   * Defaults to `true` so the external heartbeat (BetterUptime) still alerts on a
   * full worker outage. ECS liveness passes `false`: replacing the controller
   * can't bring workers back, so an empty fleet should not churn the instance.
   */
  failOnEmptyFleet?: boolean;
  coordination?: Pick<ICoordinationAdapter, 'getActiveReceivers'>;
}

let heartbeatSender: ConduitHeartbeatSender | null = null;

let getHeartbeatSender = async () => {
  if (!heartbeatSender) {
    let { conduit } = await import('../lib/conduit');
    heartbeatSender = conduit.createSender({
      defaultTimeout: HEARTBEAT_TIMEOUT_MS,
      maxRetries: 0
    });
  }

  return heartbeatSender;
};

export let isConduitHeartbeatPing = (value: unknown): value is ConduitHeartbeatPing => {
  if (!value || typeof value !== 'object') return false;

  let d = value as Record<string, unknown>;
  return d.type === 'health.ping' && typeof d.id === 'string' && typeof d.sentAt === 'number';
};

export let isConduitHeartbeatPong = (value: unknown): value is ConduitHeartbeatPong => {
  if (!value || typeof value !== 'object') return false;

  let d = value as Record<string, unknown>;
  return (
    d.type === 'health.pong' &&
    typeof d.id === 'string' &&
    typeof d.sentAt === 'number' &&
    typeof d.receivedAt === 'number'
  );
};

export let checkConduitHeartbeat = async (opts: CheckConduitHeartbeatOpts = {}) => {
  if (isFleetHealthEnabled()) {
    return checkConduitHeartbeatFleet(opts);
  }
  return checkConduitHeartbeatLegacy(opts);
};

let checkConduitHeartbeatLegacy = async (opts: CheckConduitHeartbeatOpts = {}) => {
  let id = opts.id ?? crypto.randomUUID();
  let sentAt = opts.now?.() ?? Date.now();
  let timeoutMs = opts.timeoutMs ?? HEARTBEAT_TIMEOUT_MS;
  let sender = opts.sender ?? (await getHeartbeatSender());
  let topic = topics.workerHeartbeat.encode();

  // For callers that tolerate an empty fleet (ECS liveness), short-circuit before
  // the send so a worker outage - which makes the send throw "No receiver
  // available" - doesn't churn this instance. The external heartbeat keeps the
  // default (failOnEmptyFleet) and still alerts.
  if (opts.failOnEmptyFleet === false) {
    let coordination = opts.coordination ?? conduit.coordination;
    let active = await coordination.getActiveReceivers().catch(() => null);
    if (active && active.length === 0) {
      return { emptyFleet: true } as const;
    }
  }

  let ping = {
    type: 'health.ping',
    id,
    sentAt
  } satisfies ConduitHeartbeatPing;

  let response: ConduitResponse;
  try {
    response = await sender.send(topic, ping, timeoutMs);
  } catch (err) {
    throw new ConduitHeartbeatError(
      `Conduit heartbeat failed: ${err instanceof Error ? err.message : String(err)}`,
      err instanceof Error ? err : undefined
    );
  }

  if (!response.success) {
    throw new ConduitHeartbeatError(
      `Conduit heartbeat failed: ${response.error ?? 'worker returned an unsuccessful response'}`
    );
  }

  if (!isConduitHeartbeatPong(response.result)) {
    throw new ConduitHeartbeatError(
      'Conduit heartbeat failed: worker returned an invalid pong'
    );
  }

  if (response.result.id !== id || response.result.sentAt !== sentAt) {
    throw new ConduitHeartbeatError(
      'Conduit heartbeat failed: worker returned a mismatched pong'
    );
  }

  return response.result;
};

let fleetSender: Sender | null = null;

let getFleetSender = (): Sender => {
  if (!fleetSender) {
    fleetSender = conduit.createSender({
      defaultTimeout: HEARTBEAT_TIMEOUT_MS,
      maxRetries: 0
    });
  }
  return fleetSender;
};

// Per-receiver churn-tolerance state (controller-local). first-seen lets us
// apply a startup grace; consecutive-failure counts avoid false alerts on a
// transient blip.
let receiverFirstSeenAt = new Map<string, number>();
let receiverConsecutiveFailures = new Map<string, number>();

export interface CheckConduitHeartbeatFleetOpts {
  coordination?: Pick<ICoordinationAdapter, 'getActiveReceivers'>;
  pingReceiver?: (receiverId: string, timeoutMs: number) => Promise<ConduitResponse>;
  timeoutMs?: number;
  now?: () => number;
  startupGraceMs?: number;
  failureThreshold?: number;
  /** See {@link CheckConduitHeartbeatOpts.failOnEmptyFleet}. Defaults to `true`. */
  failOnEmptyFleet?: boolean;
}

let isHealthyPong = (response: ConduitResponse): boolean =>
  response.success && isConduitHealthPong(response.result);

export let checkConduitHeartbeatFleet = async (opts: CheckConduitHeartbeatFleetOpts = {}) => {
  let now = opts.now?.() ?? Date.now();
  let timeoutMs = opts.timeoutMs ?? HEARTBEAT_TIMEOUT_MS;
  let startupGraceMs = opts.startupGraceMs ?? FLEET_STARTUP_GRACE_MS;
  let failureThreshold = opts.failureThreshold ?? FLEET_FAILURE_THRESHOLD;
  let coordination = opts.coordination ?? conduit.coordination;
  let pingReceiver =
    opts.pingReceiver ??
    ((receiverId: string, t: number) => getFleetSender().pingReceiver(receiverId, t));

  let receivers: string[];
  try {
    receivers = await coordination.getActiveReceivers();
  } catch (err) {
    throw new ConduitHeartbeatError(
      `Conduit heartbeat failed: could not list active receivers: ${err instanceof Error ? err.message : String(err)}`,
      err instanceof Error ? err : undefined
    );
  }

  // An empty fleet means a total worker outage. The external heartbeat fails
  // here (so BetterUptime alerts), but ECS liveness passes `failOnEmptyFleet:
  // false` so it doesn't churn the controller - replacing it can't bring the
  // workers back.
  if (receivers.length === 0) {
    if (opts.failOnEmptyFleet === false) {
      return { activeReceivers: 0, probed: 0, emptyFleet: true };
    }
    throw new ConduitHeartbeatError(
      'Conduit heartbeat failed: no active receivers in the fleet'
    );
  }

  // Maintain first-seen timestamps and prune receivers that have left.
  let active = new Set(receivers);
  for (let id of [...receiverFirstSeenAt.keys()]) {
    if (!active.has(id)) {
      receiverFirstSeenAt.delete(id);
      receiverConsecutiveFailures.delete(id);
    }
  }
  for (let id of receivers) {
    if (!receiverFirstSeenAt.has(id)) receiverFirstSeenAt.set(id, now);
  }

  // Only probe receivers that are past the startup grace.
  let toProbe = receivers.filter(
    id => now - (receiverFirstSeenAt.get(id) ?? now) >= startupGraceMs
  );

  let wedged: string[] = [];

  await Promise.all(
    toProbe.map(async id => {
      try {
        let response = await pingReceiver(id, timeoutMs);
        if (!isHealthyPong(response)) {
          throw new Error(response.error ?? 'invalid health pong');
        }
        receiverConsecutiveFailures.set(id, 0);
      } catch {
        // Re-fetch the active set: if the receiver has since left the pool it is
        // leaving (deploy / scale-in / crash-replace), not wedged - discount it.
        let stillActive: string[] | null = null;
        try {
          stillActive = await coordination.getActiveReceivers();
        } catch {
          stillActive = null; // coordination uncertain
        }

        // Can't confirm state during a coordination blip: skip this cycle so a
        // transient error doesn't accumulate toward the wedged threshold for an
        // otherwise-healthy receiver.
        if (stillActive === null) return;

        if (!stillActive.includes(id)) {
          receiverFirstSeenAt.delete(id);
          receiverConsecutiveFailures.delete(id);
          return;
        }

        let failures = (receiverConsecutiveFailures.get(id) ?? 0) + 1;
        receiverConsecutiveFailures.set(id, failures);
        if (failures >= failureThreshold) {
          wedged.push(id);
        }
      }
    })
  );

  if (wedged.length > 0) {
    throw new ConduitHeartbeatError(
      `Conduit heartbeat failed: ${wedged.length} active receiver(s) wedged: ${wedged.join(', ')}`
    );
  }

  return { activeReceivers: receivers.length, probed: toProbe.length };
};

export interface CheckConduitSelfHealthOpts {
  receiverId?: string;
  pingReceiver?: (receiverId: string, timeoutMs: number) => Promise<ConduitResponse>;
  timeoutMs?: number;
}

export let checkConduitSelfHealth = async (opts: CheckConduitSelfHealthOpts = {}) => {
  let timeoutMs = opts.timeoutMs ?? HEARTBEAT_TIMEOUT_MS;

  let receiverId = opts.receiverId;
  if (!receiverId) {
    let { getConnectionReceiver } = await import('../controller/receiver');
    let receiver = getConnectionReceiver();
    if (!receiver) {
      throw new ConduitHeartbeatError(
        'Conduit self-health failed: no local receiver is running'
      );
    }
    // During startup the receiver may not be ready yet; treat as healthy so we
    // do not flap before the subscription is established.
    if (!receiver.isReady()) {
      return { receiverId: receiver.getReceiverId(), ready: false };
    }
    // Fast local wedge signal before paying for an end-to-end round trip.
    if (!receiver.isHealthy()) {
      throw new ConduitHeartbeatError(
        `Conduit self-health failed: local receiver ${receiver.getReceiverId()} is unhealthy`
      );
    }
    receiverId = receiver.getReceiverId();
  }

  let pingReceiver =
    opts.pingReceiver ?? ((rid: string, t: number) => getFleetSender().pingReceiver(rid, t));

  let response: ConduitResponse;
  try {
    response = await pingReceiver(receiverId, timeoutMs);
  } catch (err) {
    throw new ConduitHeartbeatError(
      `Conduit self-health failed: ${err instanceof Error ? err.message : String(err)}`,
      err instanceof Error ? err : undefined
    );
  }

  if (!isHealthyPong(response)) {
    throw new ConduitHeartbeatError(
      `Conduit self-health failed: ${response.error ?? 'local receiver returned an invalid pong'}`
    );
  }

  return { receiverId, ready: true };
};
