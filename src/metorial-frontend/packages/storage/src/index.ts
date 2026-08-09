import { IDBPDatabase, openDB } from 'idb';

let openStore = (name: string) => {
  let dbp: Promise<IDBPDatabase<unknown>> =
    // @ts-ignore
    typeof window == 'undefined'
      ? new Promise(() => {})
      : openDB(`metorial_${name}`, 1, {
          upgrade(db) {
            db.createObjectStore(name);
          }
        });

  return async () => {
    let db = await dbp;
    return db.transaction(name, 'readwrite').objectStore(name);
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
