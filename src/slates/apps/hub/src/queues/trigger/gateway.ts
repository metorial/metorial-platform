import { delay } from '@lowerdeck/delay';
import { generatePlainId } from '@lowerdeck/id';
import { getSentry } from '@lowerdeck/sentry';
import { hostname } from 'node:os';
import { db } from '../../db';
import type { SlateInvocationStack } from '../../lib/invocation/stack';
import {
  assertPublicWebSocketUrl,
  WebSocketUrlNotAllowedError
} from '../../lib/network/assertPublicWebSocketUrl';
import { AuthConfigSecretSerializer } from '../../lib/secretSerializer';
import { getActiveSlateVersion } from '../../lib/slateVersion';
import { secretService } from '../../services/secret';
import { slateInvocationService } from '../../services/slateInvocation';
import {
  TRIGGER_GATEWAY_CONNECT_FAILURES_BEFORE_ERROR,
  TRIGGER_GATEWAY_CONTEXT_TTL_MS,
  TRIGGER_GATEWAY_FRAME_BATCH_DELAY_MS,
  TRIGGER_GATEWAY_HEALTHY_UPTIME_MS,
  TRIGGER_GATEWAY_HEARTBEAT_ACK_RECHECK_MS,
  TRIGGER_GATEWAY_IDLE_TIMEOUT_MS,
  TRIGGER_GATEWAY_LEASE_MS,
  TRIGGER_GATEWAY_MAX_BATCH_FRAMES,
  TRIGGER_GATEWAY_MAX_CONNECTIONS_PER_WORKER,
  TRIGGER_GATEWAY_MAX_PENDING_FRAMES,
  TRIGGER_GATEWAY_STATE_PERSIST_INTERVAL_MS,
  TRIGGER_GATEWAY_TICK_MS,
  triggerGatewayReconnectBackoffMs
} from './_config';
import { createTriggerRegistrationInstanceError } from './_instanceError';
import { createTriggerRawEvents } from './_rawEvent';

let Sentry = getSentry();

let WORKER_ID = `${hostname()}:${process.pid}:${generatePlainId(8)}`;

// Not 1000/1001: those make providers like Discord drop the resumable session.
let RESUMABLE_CLOSE_CODE = 4000;

// Close reasons over 123 UTF-8 bytes throw.
let closeReason = (reason: string) => {
  let bytes = new TextEncoder().encode(reason);
  if (bytes.length <= 123) return reason;
  return new TextDecoder().decode(bytes.slice(0, 120)).replace(/\uFFFD$/, '') + '...';
};

let include = {
  triggerRegistrationInstance: {
    include: {
      triggerGroup: true,
      triggerRegistration: {
        include: {
          tenant: true,
          slate: true,
          instance: true,
          instanceConfig: true,
          authConfig: { include: { authMethod: true } }
        }
      }
    }
  }
};

let loadGateway = async (oid: bigint) => {
  let record = await db.triggerRegistrationGateway.findUnique({ where: { oid }, include });
  if (!record || record.isDisabled) return null;
  if (record.triggerRegistrationInstance.triggerRegistration.status !== 'active') return null;
  return record;
};

type GatewayRecord = NonNullable<Awaited<ReturnType<typeof loadGateway>>>;

type CloseNotice = { code: number; reason: string };

type ReceiveInput = { frames: string[]; closed: CloseNotice | null };

type HeartbeatConfig = { intervalMs: number; frame: string; expectsAck?: boolean };

type GatewayContext = {
  loadedAt: number;
  createStack: () => Promise<SlateInvocationStack>;
  serializer: AuthConfigSecretSerializer | null;
};

export class GatewayConnection {
  #stopped = false;
  #socket: WebSocket | null = null;
  #state: any;
  #persistedState = 'null';
  #lastPersistAt = 0;
  #context: GatewayContext | null = null;
  #pending: string[] = [];
  #closeNotice: CloseNotice | null = null;
  #flushTimer: ReturnType<typeof setTimeout> | null = null;
  #processing: Promise<void> | null = null;
  #connectFailures = 0;
  #heartbeat: HeartbeatConfig | null = null;
  #heartbeatTimer: ReturnType<typeof setTimeout> | null = null;
  #heartbeatUnackedSince: number | null = null;
  #idleTimer: ReturnType<typeof setInterval> | null = null;
  #lastFrameAt = 0;
  #closeRequested: { reconnect: boolean; reason?: string } | null = null;

  constructor(
    readonly oid: bigint,
    readonly id: string,
    readonly triggerRegistrationInstanceOid: bigint,
    private readonly onExit: () => void
  ) {}

  start() {
    void this.#run().finally(this.onExit);
  }

  stop() {
    if (this.#stopped) return;
    this.#stopped = true;
    this.#socket?.close(RESUMABLE_CLOSE_CODE, 'shutting down');
  }

  // Hub-initiated close; the slate gets no close notice.
  #closeForReconnect(reason: string) {
    this.#closeRequested = { reconnect: true, reason };
    this.#socket?.close(RESUMABLE_CLOSE_CODE, closeReason(reason));
  }

  async #run() {
    let attempt = 0;
    while (!this.#stopped) {
      try {
        let connected = await this.#connectOnce();
        attempt = connected ? 0 : attempt + 1;
      } catch (err) {
        attempt++;
        Sentry.captureException(err, { extra: { gatewayId: this.id } });
        await this.#recordConnectFailure(
          'gateway_connection_failed',
          String((err as Error)?.message ?? err)
        );
      }
      if (this.#stopped) break;
      await delay(triggerGatewayReconnectBackoffMs(attempt));
    }
    await this.#persistState(true).catch(() => {});
    await db.triggerRegistrationGateway
      .updateMany({
        where: { oid: this.oid, claimedBy: WORKER_ID },
        data: { claimedBy: null, claimedUntil: null }
      })
      .catch(() => {});
  }

  async #getContext(record: GatewayRecord) {
    if (
      this.#context &&
      Date.now() - this.#context.loadedAt < TRIGGER_GATEWAY_CONTEXT_TTL_MS
    ) {
      return this.#context;
    }

    let instance = record.triggerRegistrationInstance;
    let registration = instance.triggerRegistration;

    let version = await getActiveSlateVersion({
      slate: registration.slate,
      instance: registration.instance
    });

    let auth: { authenticationMethodId: string; data: Record<string, any> } | null = null;
    if (registration.authConfig) {
      let decrypted = await secretService.DANGEROUSLY_decryptSecret({
        secretOid: registration.authConfig.secretOid,
        purpose: 'slate_authentication_configuration',
        tenant: registration.tenant,
        note: `trigger-gateway:${record.id}`
      });
      auth = {
        authenticationMethodId: registration.authConfig.authMethod.key,
        data: decrypted.output ?? decrypted.input ?? {}
      };
    }

    let serializer = auth ? new AuthConfigSecretSerializer(auth.data) : null;

    let createStack = () =>
      slateInvocationService.createInvocationWithState({
        participants: [],
        slateVersion: version,
        tenant: registration.tenant,
        session: { id: instance.id, state: {} },
        config: registration.instanceConfig.value ?? {},
        auth
      });

    this.#context = { loadedAt: Date.now(), createStack, serializer };
    return this.#context;
  }

  async #connectOnce(): Promise<boolean> {
    let record = await loadGateway(this.oid);
    if (!record) {
      this.stop();
      return false;
    }

    // The secret only holds raw input until auth processing finishes; retry after backoff.
    if (record.triggerRegistrationInstance.triggerRegistration.authConfig?.isProcessing) {
      return false;
    }

    if (this.#state === undefined) {
      this.#state = record.state ?? null;
      this.#persistedState = JSON.stringify(this.#state);
    }

    this.#context = null;
    let context = await this.#getContext(record);
    let triggerGroupId = record.triggerRegistrationInstance.triggerGroup.key;

    let connected = await slateInvocationService.connectTriggerGroupGateway({
      stack: await context.createStack(),
      triggerGroupId,
      state: this.#state
    });
    if (connected.status === 'error') {
      await this.#recordConnectFailure(connected.error.code, connected.error.message);
      return false;
    }

    try {
      await assertPublicWebSocketUrl(connected.data.url);
    } catch (err) {
      if (!(err instanceof WebSocketUrlNotAllowedError)) throw err;
      await this.#recordConnectFailure(err.code, err.message);
      return false;
    }

    this.#connectFailures = 0;
    if (connected.data.state !== undefined) this.#state = connected.data.state;
    await this.#persistState(true);

    if (this.#stopped) return false;

    this.#closeRequested = null;
    this.#closeNotice = null;
    this.#pending = [];
    this.#heartbeat = null;
    this.#heartbeatUnackedSince = null;
    this.#lastFrameAt = Date.now();

    let socket = new WebSocket(connected.data.url);
    socket.binaryType = 'arraybuffer';
    this.#socket = socket;
    this.#startIdleTimer();

    let openedAt: number | null = null;
    await new Promise<void>(resolve => {
      socket.addEventListener('open', () => {
        openedAt = Date.now();
        void db.triggerRegistrationGateway
          .update({
            where: { oid: this.oid },
            data: { lastConnectedAt: new Date(), lastErrorCode: null, lastErrorMessage: null }
          })
          .catch(() => {});
      });

      socket.addEventListener('message', event => {
        this.#lastFrameAt = Date.now();
        let frame =
          typeof event.data === 'string'
            ? event.data
            : new TextDecoder().decode(event.data as ArrayBuffer);
        this.#pending.push(frame);
        if (this.#pending.length > TRIGGER_GATEWAY_MAX_PENDING_FRAMES) {
          // Dropped frames are replayed on resume.
          this.#pending = [];
          this.#closeForReconnect('event backlog too large');
          return;
        }
        this.#scheduleFlush(record, triggerGroupId);
      });

      socket.addEventListener('close', event => {
        this.#clearHeartbeat();
        this.#clearIdleTimer();
        if (this.#flushTimer) clearTimeout(this.#flushTimer);
        this.#flushTimer = null;

        let unexpected = !this.#stopped && !this.#closeRequested;
        this.#closeNotice = unexpected
          ? { code: event.code, reason: event.reason ?? '' }
          : null;
        void this.#process(record, triggerGroupId).then(() => resolve());
      });
    });

    this.#socket = null;
    return openedAt !== null && Date.now() - openedAt >= TRIGGER_GATEWAY_HEALTHY_UPTIME_MS;
  }

  #scheduleFlush(record: GatewayRecord, triggerGroupId: string) {
    if (this.#flushTimer) return;
    this.#flushTimer = setTimeout(() => {
      this.#flushTimer = null;
      void this.#process(record, triggerGroupId);
    }, TRIGGER_GATEWAY_FRAME_BATCH_DELAY_MS);
  }

  #process(record: GatewayRecord, triggerGroupId: string): Promise<void> {
    if (this.#processing) return this.#processing;
    if (this.#pending.length === 0 && !this.#closeNotice) return Promise.resolve();

    let drain = async () => {
      try {
        while (this.#pending.length > 0 || this.#closeNotice) {
          let frames = this.#pending.splice(0, TRIGGER_GATEWAY_MAX_BATCH_FRAMES);
          let closed = this.#pending.length === 0 ? this.#closeNotice : null;
          if (closed) this.#closeNotice = null;
          await this.#receive(record, triggerGroupId, { frames, closed });
        }
      } catch (err) {
        Sentry.captureException(err, { extra: { gatewayId: this.id } });
        this.#pending = [];
        this.#closeNotice = null;
        this.#closeForReconnect('processing failed');
      }
    };
    // Clear in finally, not in drain, which can finish before this assignment.
    this.#processing = drain().finally(() => {
      this.#processing = null;
    });
    return this.#processing;
  }

  async #receive(record: GatewayRecord, triggerGroupId: string, input: ReceiveInput) {
    let context = await this.#getContext(record);
    let result = await slateInvocationService.receiveTriggerGroupGatewayFrames({
      stack: await context.createStack(),
      triggerGroupId,
      state: this.#state,
      frames: input.frames,
      closed: input.closed
    });

    if (result.status === 'error') {
      await this.#recordError(result.error.code, result.error.message);
      this.#pending = [];
      this.#closeForReconnect('processing failed');
      return;
    }

    let data = result.data;

    let socket = this.#socket;
    if (socket && socket.readyState === WebSocket.OPEN) {
      for (let frame of data.send) {
        socket.send(context.serializer ? context.serializer.deserialize(frame) : frame);
      }
    }

    if (data.events.length > 0) {
      await createTriggerRawEvents({
        source: 'gateway',
        events: data.events.map(event => ({
          triggerRegistrationInstanceOids: [record.triggerRegistrationInstanceOid],
          payload: event.payload,
          idempotencyKey: event.idempotencyKey,
          triggerIds: event.triggerIds
        }))
      });
    }

    // Advance state only after events are stored so a failed insert replays on resume.
    if (data.state !== undefined) this.#state = data.state;

    if ((data as { heartbeatAcked?: boolean }).heartbeatAcked === true) {
      this.#heartbeatUnackedSince = null;
    }
    if (data.heartbeat !== undefined) this.#setHeartbeat(data.heartbeat);

    await this.#persistState(!!data.close);

    if (data.close) {
      this.#closeRequested = data.close;
      if (!data.close.reconnect) {
        await this.#disable(
          data.close.reason ?? 'The provider connection was closed permanently.'
        );
      }
      socket?.close(RESUMABLE_CLOSE_CODE, closeReason(data.close.reason ?? 'closing'));
    }
  }

  #setHeartbeat(heartbeat: HeartbeatConfig | null) {
    let intervalChanged = heartbeat?.intervalMs !== this.#heartbeat?.intervalMs;
    this.#heartbeat = heartbeat;
    if (!heartbeat?.expectsAck) this.#heartbeatUnackedSince = null;
    if (!intervalChanged) return;

    this.#clearHeartbeat();
    this.#heartbeatUnackedSince = null;
    if (!heartbeat) return;

    let beat = (nextMs: number) => {
      this.#heartbeatTimer = setTimeout(() => {
        let socket = this.#socket;
        let current = this.#heartbeat;
        if (!socket || socket.readyState !== WebSocket.OPEN || !current) return;

        // Silent for two intervals: zombie connection.
        if (Date.now() - this.#lastFrameAt > current.intervalMs * 2) {
          this.#closeForReconnect('no frames received');
          return;
        }

        if (current.expectsAck && this.#heartbeatUnackedSince !== null) {
          // The ack may still be queued for a receive call; wait up to one more interval.
          let receiving = this.#processing !== null || this.#pending.length > 0;
          if (receiving && Date.now() - this.#heartbeatUnackedSince < current.intervalMs * 2) {
            beat(TRIGGER_GATEWAY_HEARTBEAT_ACK_RECHECK_MS);
            return;
          }
          this.#closeForReconnect('heartbeat not acknowledged');
          return;
        }

        socket.send(current.frame);
        this.#heartbeatUnackedSince = current.expectsAck ? Date.now() : null;
        beat(current.intervalMs);
      }, nextMs);
    };
    beat(Math.floor(heartbeat.intervalMs * Math.random()));
  }

  #clearHeartbeat() {
    if (this.#heartbeatTimer) clearTimeout(this.#heartbeatTimer);
    this.#heartbeatTimer = null;
  }

  #startIdleTimer() {
    this.#clearIdleTimer();
    this.#idleTimer = setInterval(() => {
      let limit = Math.max(
        TRIGGER_GATEWAY_IDLE_TIMEOUT_MS,
        (this.#heartbeat?.intervalMs ?? 0) * 2
      );
      if (Date.now() - this.#lastFrameAt > limit) this.#closeForReconnect('connection idle');
    }, TRIGGER_GATEWAY_TICK_MS);
  }

  #clearIdleTimer() {
    if (this.#idleTimer) clearInterval(this.#idleTimer);
    this.#idleTimer = null;
  }

  async #persistState(force: boolean) {
    let serialized = JSON.stringify(this.#state ?? null);
    if (serialized === this.#persistedState) return;
    if (
      !force &&
      Date.now() - this.#lastPersistAt < TRIGGER_GATEWAY_STATE_PERSIST_INTERVAL_MS
    ) {
      return;
    }

    await db.triggerRegistrationGateway.updateMany({
      where: { oid: this.oid, claimedBy: WORKER_ID },
      data: { state: this.#state ?? null }
    });
    this.#persistedState = serialized;
    this.#lastPersistAt = Date.now();
  }

  async #recordError(code: string, message: string) {
    await db.triggerRegistrationGateway
      .update({
        where: { oid: this.oid },
        data: { lastErrorCode: code, lastErrorMessage: message.slice(0, 2000) }
      })
      .catch(() => {});
  }

  async #recordConnectFailure(code: string, message: string) {
    await this.#recordError(code, message);
    this.#connectFailures++;
    // Report once per failure streak.
    if (this.#connectFailures !== TRIGGER_GATEWAY_CONNECT_FAILURES_BEFORE_ERROR) return;
    await createTriggerRegistrationInstanceError({
      triggerRegistrationInstanceOid: this.triggerRegistrationInstanceOid,
      code: 'gateway_connect_failed',
      message: `The provider event connection keeps failing: ${message}`
    });
  }

  async #disable(message: string) {
    this.#stopped = true;
    await db.triggerRegistrationGateway.update({
      where: { oid: this.oid },
      data: { isDisabled: true, lastErrorCode: 'gateway_closed', lastErrorMessage: message }
    });
    await createTriggerRegistrationInstanceError({
      triggerRegistrationInstanceOid: this.triggerRegistrationInstanceOid,
      code: 'gateway_closed',
      message: `The provider closed the event connection: ${message}`
    });
  }
}

let connections = new Map<bigint, GatewayConnection>();

let leaseUntil = () => new Date(Date.now() + TRIGGER_GATEWAY_LEASE_MS);

let lastLeaseRenewalAt = Date.now();

// Stop before another worker can claim the expired lease.
let LEASE_SAFETY_MS = TRIGGER_GATEWAY_LEASE_MS - 2 * TRIGGER_GATEWAY_TICK_MS;

let renewLeases = async () => {
  if (connections.size === 0) {
    lastLeaseRenewalAt = Date.now();
    return;
  }
  let oids = [...connections.keys()];

  await db.triggerRegistrationGateway.updateMany({
    where: { oid: { in: oids }, claimedBy: WORKER_ID, isDisabled: false },
    data: { claimedUntil: leaseUntil() }
  });

  let held = await db.triggerRegistrationGateway.findMany({
    where: {
      oid: { in: oids },
      claimedBy: WORKER_ID,
      isDisabled: false,
      triggerRegistrationInstance: { triggerRegistration: { status: 'active' } }
    },
    select: { oid: true }
  });
  let heldOids = new Set(held.map(row => row.oid));
  lastLeaseRenewalAt = Date.now();

  for (let [oid, connection] of connections) {
    if (!heldOids.has(oid)) connection.stop();
  }
};

let claimGateways = async () => {
  let capacity = TRIGGER_GATEWAY_MAX_CONNECTIONS_PER_WORKER - connections.size;
  if (capacity <= 0) return;

  let unclaimed = () => ({
    isDisabled: false,
    triggerRegistrationInstance: { triggerRegistration: { status: 'active' as const } },
    OR: [{ claimedUntil: null }, { claimedUntil: { lt: new Date() } }]
  });

  let candidates = await db.triggerRegistrationGateway.findMany({
    where: unclaimed(),
    orderBy: { createdAt: 'asc' },
    take: capacity,
    select: { oid: true, id: true, triggerRegistrationInstanceOid: true }
  });

  for (let candidate of candidates) {
    if (connections.has(candidate.oid)) continue;

    let claimed = await db.triggerRegistrationGateway.updateMany({
      where: { oid: candidate.oid, ...unclaimed() },
      data: { claimedBy: WORKER_ID, claimedUntil: leaseUntil() }
    });
    if (claimed.count !== 1) continue;

    let connection = new GatewayConnection(
      candidate.oid,
      candidate.id,
      candidate.triggerRegistrationInstanceOid,
      () => connections.delete(candidate.oid)
    );
    connections.set(candidate.oid, connection);
    connection.start();
  }
};

let started = false;

// Workers lease gateways from the DB; an unrenewed lease moves to another worker.
export let startTriggerGatewayManager = () => {
  if (started) return;
  started = true;

  let tick = async () => {
    try {
      await renewLeases();
      await claimGateways();
    } catch (err) {
      Sentry.captureException(err);
      if (Date.now() - lastLeaseRenewalAt > LEASE_SAFETY_MS) {
        for (let connection of connections.values()) connection.stop();
      }
    }
  };

  let interval = setInterval(tick, TRIGGER_GATEWAY_TICK_MS);
  void tick();

  let shutdown = () => {
    clearInterval(interval);
    for (let connection of connections.values()) connection.stop();
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
};
