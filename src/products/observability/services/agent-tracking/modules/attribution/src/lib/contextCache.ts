import { randomUUID } from 'node:crypto';

export type ContextVersionKey = {
  read: () => Promise<{ version: string | null } | null>;
  publish: (version: string) => Promise<unknown>;
};

// Per process, checked against a version every process publishes to on a change, so a change
// made in the API reaches the worker's next read. The version is read before loading, so a change
// that commits mid-load leaves a newer version behind and the next read reloads. Without Redis
// (`read` returns null) only the TTL bounds staleness.
export let createContextCache = <T>(d: {
  ttlMs: number;
  load: (organizationId: string) => Promise<T>;
  versionKey: (organizationId: string) => ContextVersionKey;
  now?: () => number;
}) => {
  let now = d.now ?? Date.now;
  let entries = new Map<
    string,
    { loadedAt: number; version: string | null; value: Promise<T> }
  >();

  let get = async (organizationId: string) => {
    let published = await d.versionKey(organizationId).read();
    let version = published?.version ?? null;

    let cached = entries.get(organizationId);
    let fresh = cached && now() - cached.loadedAt < d.ttlMs;
    if (cached && fresh && (!published || cached.version == version))
      return await cached.value;

    let entry = { loadedAt: now(), version, value: d.load(organizationId) };
    entries.set(organizationId, entry);
    entry.value.catch(() => {
      if (entries.get(organizationId) == entry) entries.delete(organizationId);
    });

    return await entry.value;
  };

  let invalidate = async (organizationId: string) => {
    entries.delete(organizationId);

    await d.versionKey(organizationId).publish(`${now()}.${randomUUID()}`);
  };

  return { get, invalidate };
};
