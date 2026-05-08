import { db } from '@metorial/db';
import { createRedisClient } from '@metorial/redis';
import { JsonValue, WireMessage, WireSnapshot } from '../delta';
import { AgentRunStateOptions, AgentRunWireMessage } from './state';

type RedisAgentRunOptions = AgentRunStateOptions & {
  onSnapshot?: (snapshot: AgentRunWireMessage) => void | Promise<void>;
  snapshotIntervalMs?: number;
};

export let assistantRunDeltaKeys = (runId: string) => ({
  snapshot: `assistant:run:${runId}:snapshot`,
  deltaChannel: `assistant:run:${runId}:delta`,
  deltaReplay: `assistant:run:${runId}:delta-replay`,
  snapshotWrittenChannel: `assistant:run:${runId}:snapshot-written`
});

let messageIndex = (message: WireMessage) =>
  message[0] == 's' || message[0] == 'd' ? message[1] : message[0];

let parseWireMessage = (raw: string) => JSON.parse(raw) as AgentRunWireMessage;

let createClient = async () => await createRedisClient({}).eager();
let deltaReplayLimit = 15;

export let createAssistantRunDeltaPublisher = async (d: {
  runId: string;
  ttlSeconds?: number;
  snapshotIntervalMs?: number;
}): Promise<{
  delta: RedisAgentRunOptions;
  close: () => Promise<void>;
}> => {
  let keys = assistantRunDeltaKeys(d.runId);
  let redis = await createClient();
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

  return {
    delta: {
      emit: {
        send: publishDelta
      },
      onSnapshot: publishSnapshot,
      snapshotIntervalMs: d.snapshotIntervalMs ?? 500,
      deltaFormat: 'message'
    },
    close: async () => {
      await redis.quit();
    }
  };
};

export let listenToAssistantRunDeltas = async (d: {
  runId: string;
  signal?: AbortSignal;
  snapshotWaitTimeoutMs?: number;
  onMessage: (message: AgentRunWireMessage) => void | Promise<void>;
  onError?: (error: Error) => void | Promise<void>;
}) => {
  let keys = assistantRunDeltaKeys(d.runId);
  let redis = await createClient();
  let subscriber = redis.duplicate();
  await subscriber.connect();

  let started = false;
  let starting = false;
  let closed = false;
  let bufferedDeltas: AgentRunWireMessage[] = [];
  let cleanupFns: (() => void)[] = [];
  let snapshotTimeout: ReturnType<typeof setTimeout> | undefined;

  let emit = async (message: AgentRunWireMessage) => {
    if (closed) return;
    await d.onMessage(message);
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

    return [...deduped.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, message]) => message);
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
    } finally {
      starting = false;
    }
  };

  let emitPersistedSnapshot = async () => {
    if (started || closed) return;

    let message = await db.assistantMessage.findFirst({
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

    await startFromSnapshot(['s', snapshotIndex, message.state as JsonValue]);
  };

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

  snapshotTimeout = setTimeout(
    () => void emitPersistedSnapshot(),
    d.snapshotWaitTimeoutMs ?? 2000
  );
  cleanupFns.push(() => {
    if (snapshotTimeout) clearTimeout(snapshotTimeout);
  });

  let close = async () => {
    if (closed) return;
    closed = true;

    for (let fn of cleanupFns) fn();
    await subscriber.unsubscribe(keys.deltaChannel);
    await subscriber.unsubscribe(keys.snapshotWrittenChannel);
    await subscriber.quit();
    await redis.quit();
  };

  if (d.signal) {
    let abort = () => {
      void close();
    };
    d.signal.addEventListener('abort', abort, { once: true });
    cleanupFns.push(() => d.signal?.removeEventListener('abort', abort));
  }

  return close;
};
