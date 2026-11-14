import type { Build } from '@aws-sdk/client-codebuild';
import { QueueRetryError } from '@lowerdeck/queue';

let MAX_BUILDS_PER_REQUEST = 100;

let throttlingErrorNames = new Set([
  'ThrottlingException',
  'Throttling',
  'TooManyRequestsException',
  'RequestLimitExceeded'
]);

export let isThrottlingError = (error: unknown) => {
  let name = (error as { name?: unknown })?.name;
  if (typeof name === 'string' && throttlingErrorNames.has(name)) return true;

  return /rate exceeded|throttl/i.test(String((error as { message?: unknown })?.message ?? ''));
};

type PendingLookup = {
  resolve: (build: Build | undefined) => void;
  reject: (error: unknown) => void;
};

export let createBuildLookup = (d: {
  fetchBuilds: (ids: string[]) => Promise<Build[]>;
  windowMs?: number;
}) => {
  let windowMs = d.windowMs ?? 200;
  let pending = new Map<string, PendingLookup[]>();
  let timer: ReturnType<typeof setTimeout> | undefined;

  let flush = async () => {
    timer = undefined;

    let batch = pending;
    pending = new Map();

    let ids = [...batch.keys()];

    for (let i = 0; i < ids.length; i += MAX_BUILDS_PER_REQUEST) {
      let chunk = ids.slice(i, i + MAX_BUILDS_PER_REQUEST);

      try {
        let builds = await d.fetchBuilds(chunk);

        for (let id of chunk) {
          let build = builds.find(b => b.id === id);
          for (let lookup of batch.get(id) ?? []) lookup.resolve(build);
        }
      } catch (error) {
        let mapped = isThrottlingError(error) ? new QueueRetryError() : error;

        for (let id of chunk) {
          for (let lookup of batch.get(id) ?? []) lookup.reject(mapped);
        }
      }
    }
  };

  return (buildId: string) =>
    new Promise<Build | undefined>((resolve, reject) => {
      let lookups = pending.get(buildId) ?? [];
      lookups.push({ resolve, reject });
      pending.set(buildId, lookups);

      if (!timer) timer = setTimeout(() => void flush(), windowMs);
    });
};
