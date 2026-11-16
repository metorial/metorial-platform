export type CallbackRegistrationSync = {
  status: 'pending' | 'synced' | 'failed';
  error: { code: string; message: string | null } | null;
  syncedAt: Date | null;
};

export type CallbackRegistrationState<Sync extends CallbackRegistrationSync> =
  { status: 'registering' } | { status: 'settled' } | { status: 'failed'; sync: Sync };

type RegistrationInstance<Sync> = {
  integrationInstanceProviderId: string;
  createdAt: Date;
  sync: Sync;
};

let canonicalJson = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map(key => `${JSON.stringify(key)}:${canonicalJson((value as any)[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value ?? null);
};

export let sameTriggerGroupSelections = (a: unknown, b: unknown) =>
  canonicalJson(a ?? {}) === canonicalJson(b ?? {});

// A connection can list several active generations while one replaces another: the newest is
// the one being registered, older ones keep serving or wait to be archived.
let newestPerConnection = <Sync>(instances: RegistrationInstance<Sync>[]) => {
  let newest = new Map<string, RegistrationInstance<Sync>>();

  for (let instance of instances) {
    let current = newest.get(instance.integrationInstanceProviderId);
    if (!current || instance.createdAt.getTime() > current.createdAt.getTime()) {
      newest.set(instance.integrationInstanceProviderId, instance);
    }
  }

  return [...newest.values()];
};

export let getCallbackRegistrationState = <Sync extends CallbackRegistrationSync>({
  callback,
  callbackInstances,
  selectionsChangedAt
}: {
  callback: { sync: Sync };
  callbackInstances: RegistrationInstance<Sync>[];
  selectionsChangedAt: Date | null;
}): CallbackRegistrationState<Sync> => {
  if (callback.sync.status === 'pending') return { status: 'registering' };
  if (callback.sync.status === 'failed') return { status: 'failed', sync: callback.sync };

  let current = newestPerConnection(callbackInstances);

  if (current.some(instance => instance.sync.status === 'pending')) {
    return { status: 'registering' };
  }

  // Until the background job has created the replacement, a generation from before the change
  // still serves the old selections, so its old failure is not news.
  let isStale = (instance: { createdAt: Date }) =>
    !!selectionsChangedAt && instance.createdAt.getTime() < selectionsChangedAt.getTime();

  let failed = current.find(
    instance => instance.sync.status === 'failed' && !isStale(instance)
  );
  if (failed) return { status: 'failed', sync: failed.sync };

  if (current.some(isStale)) return { status: 'registering' };

  return { status: 'settled' };
};
