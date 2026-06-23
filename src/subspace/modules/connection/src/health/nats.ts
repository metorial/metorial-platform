let NATS_HEALTH_TIMEOUT_MS = 1500;

export class NatsHealthError extends Error {
  originalError?: Error;

  constructor(message: string, originalError?: Error) {
    super(message);
    this.name = 'NatsHealthError';
    this.originalError = originalError;
  }
}

export interface NatsHealthConnection {
  flush(): Promise<void>;
}

export interface CheckNatsHealthOpts {
  connection?: NatsHealthConnection;
  timeoutMs?: number;
}

let getNatsConnection = async () => {
  let { broadcastNats } = await import('../lib/nats');
  return broadcastNats;
};

let withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, message: string) => {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
      })
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
};

export let checkNatsHealth = async (opts: CheckNatsHealthOpts = {}) => {
  let connection = opts.connection ?? (await getNatsConnection());
  let timeoutMs = opts.timeoutMs ?? NATS_HEALTH_TIMEOUT_MS;

  try {
    await withTimeout(
      connection.flush(),
      timeoutMs,
      `NATS health check timed out after ${timeoutMs}ms`
    );
  } catch (err) {
    throw new NatsHealthError(
      `NATS health check failed: ${err instanceof Error ? err.message : String(err)}`,
      err instanceof Error ? err : undefined
    );
  }
};
