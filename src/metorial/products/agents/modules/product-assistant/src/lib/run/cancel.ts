import { createRedisClient } from '@metorial/redis';

let cancelTtlSeconds = 60 * 60;
let cancelPollIntervalMs = 500;

let cancelKey = (requestId: string) => `product-assistant:request:${requestId}:cancel`;

let createClient = async () => await createRedisClient({}).eager();

export let requestAssistantRunCancel = async (d: { requestId: string }) => {
  let redis = await createClient();

  try {
    await redis.set(cancelKey(d.requestId), '1', { EX: cancelTtlSeconds });
  } finally {
    await redis.quit();
  }
};

export let watchAssistantRunCancel = async (d: {
  requestId: string;
  onCancel: () => void;
}) => {
  let redis = await createClient();
  let cancelled = false;
  let checking = false;

  let check = async () => {
    if (cancelled || checking) return;

    checking = true;
    try {
      if (await redis.get(cancelKey(d.requestId))) {
        cancelled = true;
        d.onCancel();
      }
    } finally {
      checking = false;
    }
  };

  let interval = setInterval(() => void check().catch(() => {}), cancelPollIntervalMs);

  return {
    get cancelled() {
      return cancelled;
    },

    close: async () => {
      clearInterval(interval);
      await redis.quit().catch(() => {});
    }
  };
};
