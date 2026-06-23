import type { ConduitResponse } from '@metorial-subspace/conduit';
import type {
  ConduitHeartbeatPing,
  ConduitHeartbeatPong
} from '@metorial-subspace/connection-utils';
import { conduit } from '../lib/conduit';
import { topics } from '../lib/topic';

let HEARTBEAT_TIMEOUT_MS = 1500;

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
}

let heartbeatSender: ConduitHeartbeatSender | null = null;

let getHeartbeatSender = async () => {
  if (!heartbeatSender) {
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
  let id = opts.id ?? crypto.randomUUID();
  let sentAt = opts.now?.() ?? Date.now();
  let timeoutMs = opts.timeoutMs ?? HEARTBEAT_TIMEOUT_MS;
  let sender = opts.sender ?? (await getHeartbeatSender());
  let topic = topics.workerHeartbeat.encode();

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
