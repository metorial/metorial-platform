import { IDBPDatabase, openDB } from 'idb';

let isClosingConnectionError = (e: unknown) =>
  (e as { name?: string } | null)?.name == 'InvalidStateError';

let openStore = (name: string) => {
  let dbp: Promise<IDBPDatabase<unknown>> | undefined;

  let forget = (p: Promise<IDBPDatabase<unknown>>) => {
    if (dbp == p) dbp = undefined;
  };

  let getDb = () => {
    if (dbp) return dbp;

    let p: Promise<IDBPDatabase<unknown>> = openDB(`metorial_${name}`, 1, {
      upgrade(db) {
        db.createObjectStore(name);
      },
      terminated() {
        forget(p);
      }
    });
    p.catch(() => forget(p));

    dbp = p;
    return p;
  };

  return async () => {
    // @ts-ignore
    if (typeof window == 'undefined') return new Promise<never>(() => {});

    let p = getDb();
    let db = await p;

    try {
      return db.transaction(name, 'readwrite').objectStore(name);
    } catch (e) {
      if (!isClosingConnectionError(e)) throw e;

      // The browser can close a connection before terminated fires
      forget(p);
      let fresh = await getDb();
      return fresh.transaction(name, 'readwrite').objectStore(name);
    }
  };
};

export let createStorage = <T>(name: string) => {
  let store = openStore(name);

  return {
    async get() {
      let s = await store();
      return (await s.get('value')) as T | undefined;
    },

    async set(value: T) {
      let s = await store();
      await s.put(value, 'value');
    }
  };
};

export let createObjectStorage = <T>(name: string) => {
  let store = openStore(name);

  return {
    async get(key: string) {
      let s = await store();
      return (await s.get(key)) as T | undefined;
    },

    async set(key: string, value: T) {
      let s = await store();
      await s.put(value, key);
    },

    async remove(key: string) {
      let s = await store();
      await s.delete(key);
    },

    async keys() {
      let s = await store();
      return (await s.getAllKeys()) as string[];
    },

    async entries() {
      let s = await store();
      let [keys, values] = await Promise.all([s.getAllKeys(), s.getAll()]);

      return (keys as string[]).map((key, index) => [key, values[index] as T] as const);
    }
  };
};
