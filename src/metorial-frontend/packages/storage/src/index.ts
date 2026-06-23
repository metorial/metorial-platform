import { IDBPDatabase, openDB } from 'idb';

export let createStorage = <T>(name: string) => {
  let dbp: Promise<IDBPDatabase<unknown>> =
    // @ts-ignore
    typeof window == 'undefined'
      ? new Promise(() => {})
      : openDB(`metorial_${name}`, 1, {
          upgrade(db) {
            db.createObjectStore(name);
          }
        });

  let store = async () => {
    let db = await dbp;
    return db.transaction(name, 'readwrite').objectStore(name);
  };

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
