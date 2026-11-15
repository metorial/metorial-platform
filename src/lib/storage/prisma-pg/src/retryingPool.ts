import { AsyncResource } from 'node:async_hooks';
import pg, { type PoolClient, type PoolConfig } from 'pg';
import {
  createRetryReporter,
  getErrorDetails,
  type PrismaPgAdapterOptions,
  type RetryReport
} from './reporting';

let MAX_ATTEMPTS = 3;
let RETRY_BASE_DELAY_MS = 100;
let RETRY_BUDGET_MS = 1000;

type ReleaseCallback = (error?: Error | boolean) => void;

type ConnectCallback = (
  error: Error | undefined,
  client: PoolClient | undefined,
  release: ReleaseCallback
) => void;

type PoolConfigWithSetup = PoolConfig & {
  onConnect?: (client: PoolClient) => void | Promise<void>;
};

export class RetryingPool extends pg.Pool {
  private pendingRetries = new Set<() => void>();

  private closing = false;

  private setupErrors: WeakSet<object>;

  constructor(
    config: PoolConfig,
    private retryOptions: PrismaPgAdapterOptions
  ) {
    let setupErrors = new WeakSet<object>();
    let onConnect = (config as PoolConfigWithSetup).onConnect;
    let poolConfig: PoolConfigWithSetup = onConnect
      ? {
          ...config,
          onConnect: async client => {
            try {
              await onConnect(client);
            } catch (error) {
              if (error && typeof error === 'object') setupErrors.add(error);
              throw error;
            }
          }
        }
      : config;

    super(poolConfig);
    this.setupErrors = setupErrors;
  }

  override connect(): Promise<PoolClient>;
  override connect(callback: ConnectCallback): void;
  override connect(callback?: ConnectCallback): Promise<PoolClient> | void {
    if (!callback) {
      return new Promise<PoolClient>((resolve, reject) => {
        this.connect((error, client) => (error ? reject(error) : resolve(client!)));
      });
    }

    let startedAt = performance.now();
    let report = createRetryReporter(this.options, this.retryOptions);

    let attempt = 0;
    let retries = 0;
    let completed = false;
    let lastError: Error | undefined;
    let lastRelease: ReleaseCallback = () => {};

    let finish = AsyncResource.bind(
      (
        error: Error | undefined,
        client: PoolClient | undefined,
        release: ReleaseCallback,
        reason?: RetryReport['reason']
      ) => {
        if (completed) return;
        completed = true;

        if (retries > 0) {
          report({
            type: !error
              ? 'recovered'
              : reason === 'shutdown' || reason === 'non_retryable'
                ? 'terminated'
                : 'exhausted',
            attempt,
            maxAttempts: MAX_ATTEMPTS,
            elapsedMs: performance.now() - startedAt,
            reason,
            error: error ?? lastError
          });
        }

        callback(error, client, release);
      }
    );

    let acquire = () => {
      if (lastError && (this.closing || this.ending)) {
        finish(lastError, undefined, lastRelease, 'shutdown');
        return;
      }

      attempt += 1;

      // pg may complete acquisition from a different request's pool-release callback.
      super.connect(
        AsyncResource.bind((error, client, release) => {
          if (!error) {
            finish(undefined, client, release);
            return;
          }

          lastError = error;
          lastRelease = release;

          // Setup hooks run after connecting and can already have performed writes.
          let retryable =
            !this.setupErrors.has(error) && getErrorDetails(error).code === 'EAI_AGAIN';
          let shuttingDown = this.closing || this.ending;

          if (!retryable || attempt >= MAX_ATTEMPTS || shuttingDown) {
            finish(
              error,
              undefined,
              release,
              shuttingDown ? 'shutdown' : retryable ? 'attempts' : 'non_retryable'
            );
            return;
          }

          let backoffMs = RETRY_BASE_DELAY_MS * 2 ** (attempt - 1) * (0.5 + Math.random());
          let elapsedMs = performance.now() - startedAt;

          if (elapsedMs + backoffMs > RETRY_BUDGET_MS) {
            finish(error, undefined, release, 'budget');
            return;
          }

          retries += 1;
          report({
            type: 'scheduled',
            attempt,
            nextAttempt: attempt + 1,
            maxAttempts: MAX_ATTEMPTS,
            backoffMs,
            elapsedMs,
            error
          });

          let cancel = () => {
            clearTimeout(timer);
            this.pendingRetries.delete(cancel);
            queueMicrotask(() => finish(error, undefined, release, 'shutdown'));
          };

          let timer = setTimeout(() => {
            this.pendingRetries.delete(cancel);

            if (performance.now() - startedAt > RETRY_BUDGET_MS) {
              finish(error, undefined, release, 'budget');
              return;
            }

            acquire();
          }, backoffMs);

          this.pendingRetries.add(cancel);
        })
      );
    };

    acquire();
  }

  override end(): Promise<void>;
  override end(callback: () => void): void;
  override end(callback?: () => void): Promise<void> | void {
    this.closing = true;

    for (let cancel of this.pendingRetries) cancel();

    if (callback) return super.end(callback);
    return super.end();
  }
}
