import { mergeSignerKey, type PublishedKey } from './keySet';
import { inClusterConfigMapApi, KubeApiError, type ConfigMapApi } from './kube';

let DEFAULT_INTERVAL_MS = 60 * 1000;
let RETRY_DELAY_MS = 10 * 1000;
let CONFLICT_ATTEMPTS = 5;
let STALE_INTERVALS = 3;

export type TrustTarget = { namespace: string; name: string };

export type TrustTargetStatus = {
  target: TrustTarget;
  lastAttemptAt?: Date;
  publishedAt?: Date;
  lastError?: string;
};

export type TrustPublisherLogger = {
  info: (message: string, data?: object) => void;
  warn: (message: string, data?: object) => void;
};

export let parseTrustTargets = (entries: string[]): TrustTarget[] =>
  entries
    .map(entry => entry.trim())
    .filter(Boolean)
    .map(entry => {
      let [namespace, name, ...rest] = entry.split('/');
      if (!namespace || !name || rest.length) {
        throw new Error(`Trust ConfigMap "${entry}" must be "namespace/name"`);
      }
      return { namespace, name };
    });

export let describeTarget = (target: TrustTarget) => `${target.namespace}/${target.name}`;

export let describeKubeError = (err: unknown, target: TrustTarget) => {
  if (!(err instanceof KubeApiError)) return err instanceof Error ? err.message : String(err);

  if (err.status == 404) {
    return `ConfigMap ${describeTarget(target)} does not exist. The Helm chart creates it; run helm upgrade to recreate it.`;
  }
  if (err.status == 401 || err.status == 403) {
    return `Not allowed to update ConfigMap ${describeTarget(target)} (${err.status}). Check the Role binding this ServiceAccount to it.`;
  }
  return err.message;
};

// Read-modify-write with the resourceVersion: functions and build share egress-trust, so a write
// based on a stale read is rejected (409) and retried on fresh data.
export let publishTrustKey = async (d: {
  api: ConfigMapApi;
  target: TrustTarget;
  signer: string;
  key: PublishedKey;
}) => {
  for (let attempt = 1; ; attempt++) {
    let configMap = await d.api.get(d.target.namespace, d.target.name);
    let merged = mergeSignerKey(configMap.data, d.signer, d.key);
    if (!merged.changed) return 'unchanged' as const;

    try {
      await d.api.replace({ ...configMap, data: merged.data });
      return 'updated' as const;
    } catch (err) {
      if (
        !(err instanceof KubeApiError && err.status == 409) ||
        attempt >= CONFLICT_ATTEMPTS
      ) {
        throw err;
      }
    }
  }
};

export let startTrustPublisher = (d: {
  signer: string;
  key: PublishedKey;
  targets: TrustTarget[];
  api?: ConfigMapApi;
  intervalMs?: number;
  retryDelayMs?: number;
  logger?: TrustPublisherLogger;
  now?: () => Date;
}) => {
  let api = d.api ?? inClusterConfigMapApi({});
  let intervalMs = d.intervalMs ?? DEFAULT_INTERVAL_MS;
  let retryDelayMs = Math.min(d.retryDelayMs ?? RETRY_DELAY_MS, intervalMs);
  let logger = d.logger ?? console;
  let now = d.now ?? (() => new Date());

  let statuses = d.targets.map((target): TrustTargetStatus => ({ target }));
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;

  let publishTarget = async (status: TrustTargetStatus) => {
    status.lastAttemptAt = now();

    try {
      let result = await publishTrustKey({
        api,
        target: status.target,
        signer: d.signer,
        key: d.key
      });
      if (result == 'updated' || status.lastError) {
        logger.info(
          `Published the ${d.signer} trust key to ${describeTarget(status.target)}`,
          {
            kid: d.key.kid,
            result
          }
        );
      }

      status.publishedAt = now();
      status.lastError = undefined;
      return true;
    } catch (err) {
      let message = describeKubeError(err, status.target);
      if (message != status.lastError) {
        logger.warn(`Could not publish the ${d.signer} trust key: ${message}`, {
          kid: d.key.kid
        });
      }

      status.lastError = message;
      return false;
    }
  };

  let publishAll = async () => {
    let results = await Promise.all(statuses.map(publishTarget));
    return results.every(Boolean);
  };

  let schedule = (delayMs: number) => {
    if (stopped) return;

    timer = setTimeout(async () => {
      let ok = await publishAll();
      schedule(ok ? intervalMs : retryDelayMs);
    }, delayMs);
    timer.unref?.();
  };

  schedule(0);

  return {
    signer: d.signer,
    kid: d.key.kid,
    publishNow: publishAll,
    status: () => statuses.map(status => ({ ...status })),
    isStale: (status: TrustTargetStatus) =>
      !status.publishedAt ||
      now().getTime() - status.publishedAt.getTime() > intervalMs * STALE_INTERVALS,
    stop: () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    }
  };
};

export type TrustPublisher = ReturnType<typeof startTrustPublisher>;
