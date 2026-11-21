import { db } from '@metorial/db';
import { createRedisClient } from '@metorial/redis';
import type { JsonValue, WireMessage, WireSnapshot } from '../delta';
import type { AgentRunStateOptions, AgentRunWireMessage } from './state';

type RedisAgentRunOptions = AgentRunStateOptions & {
  onSnapshot?: (snapshot: AgentRunWireMessage) => void | Promise<void>;
  snapshotIntervalMs?: number;
};

type AssistantRunDoneMessage = {
  status: 'completed' | 'waiting_for_user' | 'cancelled' | 'failed';
};

export let assistantRunDeltaKeys = (runId: string) => ({
  snapshot: `product-assistant:run:${runId}:snapshot`,
  deltaChannel: `product-assistant:run:${runId}:delta`,
  deltaReplay: `product-assistant:run:${runId}:delta-replay`,
  snapshotWrittenChannel: `product-assistant:run:${runId}:snapshot-written`,
  doneChannel: `product-assistant:run:${runId}:done`
});

let messageIndex = (message: WireMessage) =>
  message[0] == 's' || message[0] == 'd' ? message[1] : message[0];

let parseWireMessage = (raw: string) => JSON.parse(raw) as AgentRunWireMessage;

let deltaReplayLimit = 15;

let createClient = () => createRedisClient({}).eager();

let redisPromise: ReturnType<typeof createClient> | undefined;

let getRedis = () =>
  (redisPromise ??= createClient().catch(error => {
    redisPromise = undefined;
    throw error;
  }));

export let createAssistantRunDeltaPublisher = async (d: {
  runId: string;
  ttlSeconds?: number;
  snapshotIntervalMs?: number;
}): Promise<{
  delta: RedisAgentRunOptions;
  markDone: (message: AssistantRunDoneMessage) => Promise<void>;
}> => {
  let keys = assistantRunDeltaKeys(d.runId);
  let redis = await getRedis();
  let ttlSeconds = d.ttlSeconds ?? 60 * 60;

  let publishDelta = async (message: AgentRunWireMessage) => {
    if (message[0] == 'd') {
      let encoded = JSON.stringify(message);
      await redis.lPush(keys.deltaReplay, encoded);
      await redis.lTrim(keys.deltaReplay, 0, deltaReplayLimit - 1);
      await redis.expire(keys.deltaReplay, ttlSeconds);
    }

    await redis.publish(keys.deltaChannel, JSON.stringify(message));
  };

  let publishSnapshot = async (message: AgentRunWireMessage) => {
    if (message[0] != 's') return;

    await redis.set(keys.snapshot, JSON.stringify(message), {
      EX: ttlSeconds
    });
    await redis.publish(
      keys.snapshotWrittenChannel,
      JSON.stringify({
        runId: d.runId,
        index: message[1]
      })
    );
  };

  let markDone = async (message: AssistantRunDoneMessage) => {
    await redis.publish(keys.doneChannel, JSON.stringify(message));
  };

  return {
    delta: {
      emit: {
        send: publishDelta
      },
      onSnapshot: publishSnapshot,
      snapshotIntervalMs: d.snapshotIntervalMs ?? 500,
      deltaFormat: 'message'
    },
    markDone
  };
};

export let listenToAssistantRunDeltas = async (d: {
  runId: string;
  signal?: AbortSignal;
  snapshotWaitTimeoutMs?: number;
  onMessage: (message: AgentRunWireMessage) => void | Promise<void>;
  onError?: (error: Error) => void | Promise<void>;
  onDone?: (message: AssistantRunDoneMessage) => void | Promise<void>;
}) => {
  let keys = assistantRunDeltaKeys(d.runId);
  let redis = await getRedis();
  let subscriber = redis.duplicate();
  subscriber.on('error', error =>
    console.error('Assistant run Redis subscriber error', error)
  );

  let started = false;
  let starting = false;
  let closed = false;
  let bufferedDeltas: AgentRunWireMessage[] = [];
  let snapshotTimeout: ReturnType<typeof setTimeout> | undefined;
  let terminalMessage: AssistantRunDoneMessage | null = null;

  let close = async () => {
    if (closed) return;
    closed = true;

    if (snapshotTimeout) clearTimeout(snapshotTimeout);
    d.signal?.removeEventListener('abort', abort);
    if (subscriber.isOpen) subscriber.destroy();
  };

  let abort = () => {
    void close();
  };

  let emit = async (message: AgentRunWireMessage) => {
    if (closed) return;
    await d.onMessage(message);
  };

  let emitDoneAndClose = async (message: AssistantRunDoneMessage) => {
    if (closed || terminalMessage) return;
    terminalMessage = message;

    try {
      await d.onDone?.(message);
    } finally {
      await close();
    }
  };

  let getPersistedRunStatus = async () => {
    let run = await db.productAssistantModelRun.findUnique({
      where: {
        id: d.runId
      },
      select: {
        status: true
      }
    });

    if (!run) {
      await fail(new Error(`No assistant run found for ${d.runId}`));
      return null;
    }

    if (
      run.status == 'completed' ||
      run.status == 'waiting_for_user' ||
      run.status == 'cancelled' ||
      run.status == 'failed'
    ) {
      return {
        status: run.status
      } satisfies AssistantRunDoneMessage;
    }

    return null;
  };

  let getReplayDeltas = async (snapshotIndex: number) => {
    let cached = await redis.lRange(keys.deltaReplay, 0, deltaReplayLimit - 1);
    let live = bufferedDeltas.map(message => JSON.stringify(message));
    let deduped = new Map<number, AgentRunWireMessage>();

    for (let raw of [...cached.reverse(), ...live]) {
      let message = parseWireMessage(raw);
      if (message[0] != 'd') continue;

      let index = messageIndex(message);
      if (index <= snapshotIndex) continue;
      deduped.set(index, message);
    }

    return [...deduped.entries()].sort((a, b) => a[0] - b[0]).map(([, message]) => message);
  };

  let fail = async (error: Error) => {
    if (closed) return;
    if (d.onError) {
      await d.onError(error);
      return;
    }

    throw error;
  };

  let startFromSnapshot = async (snapshot: WireSnapshot) => {
    if (started || starting || closed) return;

    starting = true;
    try {
      if (snapshotTimeout) clearTimeout(snapshotTimeout);
      await emit(snapshot);

      let lastIndex = snapshot[1];

      while (true) {
        let deltas = await getReplayDeltas(lastIndex);
        bufferedDeltas = [];
        if (deltas.length == 0) break;

        for (let delta of deltas) {
          await emit(delta);
          lastIndex = messageIndex(delta);
        }
      }

      started = true;

      let persistedStatus = await getPersistedRunStatus();
      if (persistedStatus) {
        await emitDoneAndClose(persistedStatus);
      }
    } finally {
      starting = false;
    }
  };

  let emitPersistedSnapshot = async () => {
    if (started || closed) return;

    let message = await db.productAssistantMessage.findFirst({
      where: {
        type: 'assistant',
        run: {
          id: d.runId
        }
      },
      include: {
        run: true
      }
    });

    if (!message) {
      await fail(new Error(`No assistant run snapshot available for ${d.runId}`));
      return;
    }

    let metadata = message.run?.metadata;
    let snapshotIndex =
      metadata &&
      typeof metadata == 'object' &&
      !Array.isArray(metadata) &&
      typeof metadata.finalSnapshotIndex == 'number'
        ? metadata.finalSnapshotIndex
        : 0;

    await startFromSnapshot(['s', snapshotIndex, message.state as unknown as JsonValue]);
  };

  if (d.signal?.aborted) {
    await close();
    return close;
  }

  d.signal?.addEventListener('abort', abort, { once: true });
  try {
    await subscriber.connect();
    await subscriber.subscribe(keys.deltaChannel, raw => {
      let message = parseWireMessage(raw);
      if (started) {
        void emit(message);
      } else {
        bufferedDeltas.push(message);
      }
    });

    await subscriber.subscribe(keys.snapshotWrittenChannel, () => {
      void (async () => {
        let raw = await redis.get(keys.snapshot);
        if (!raw) return;

        let snapshot = parseWireMessage(raw);
        if (snapshot[0] == 's') await startFromSnapshot(snapshot);
      })();
    });

    await subscriber.subscribe(keys.doneChannel, raw => {
      let message = JSON.parse(raw) as AssistantRunDoneMessage;
      void emitDoneAndClose(message);
    });

    if (closed) return close;
    snapshotTimeout = setTimeout(
      () => void emitPersistedSnapshot(),
      d.snapshotWaitTimeoutMs ?? 2000
    );

    let persistedStatus = await getPersistedRunStatus();
    if (persistedStatus && !terminalMessage) {
      if (!started) await emitPersistedSnapshot();
      await emitDoneAndClose(persistedStatus);
    }
  } catch (error) {
    await close();
    if (!d.signal?.aborted) throw error;
  }

  return close;
};
