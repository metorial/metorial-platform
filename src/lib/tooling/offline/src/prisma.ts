import fs from 'node:fs/promises';
import { createOfflineRecord, createOfflineValue, recordStubbedCall } from './stub';

let offlinePrismaKey = Symbol.for('lowerdeck.offline.prisma');
let pluginStateKey = Symbol.for('lowerdeck.offline.prisma.installed');

let generatedClientFilter = /[\\/]prisma[\\/]generated[\\/]client\.ts$/;
let generatedClientExport = 'export const PrismaClient = $Class.getPrismaClientClass()';

let listOperations = new Set([
  'findMany',
  'groupBy',
  'createManyAndReturn',
  'updateManyAndReturn'
]);
let batchOperations = new Set(['createMany', 'updateMany', 'deleteMany']);

let asPlainObject = (value: any) =>
  value && typeof value == 'object' && !Array.isArray(value) ? value : {};

// Import-time seeding code mostly upserts and then looks rows up again, so lookups behave as
// if the row exists and echo back whatever the query already knows about it.
let getKnownFields = (operation: string, args: any) => ({
  ...asPlainObject(args?.where),
  ...asPlainObject(operation == 'upsert' ? args?.create : args?.data)
});

let resolveModelOperation = (model: string, operation: string, args: any) => {
  recordStubbedCall('prisma');

  if (listOperations.has(operation)) return [];
  if (batchOperations.has(operation)) return { count: 0 };
  if (operation == 'count') return 0;
  return createOfflineRecord(model, getKnownFields(operation, args));
};

let createModelDelegate = (model: string) =>
  new Proxy(
    {},
    {
      get: (_, operation) => {
        if (typeof operation == 'symbol' || operation == 'then') return undefined;
        if (operation == 'fields') return createOfflineValue(`${model}.fields`);
        return async (args: any) => resolveModelOperation(model, operation, args);
      }
    }
  );

class OfflinePrismaClient {
  constructor() {
    let delegates = new Map<string, any>();

    let client: any = new Proxy(this, {
      get: (_, prop) => {
        if (typeof prop == 'symbol' || prop == 'then') return undefined;

        if (prop == '$extends') return () => client;
        if (prop == '$transaction')
          return async (input: any) =>
            typeof input == 'function' ? input(client) : Promise.all(input);
        if (prop == '$queryRaw' || prop == '$queryRawUnsafe') return async () => [];
        if (prop == '$executeRaw' || prop == '$executeRawUnsafe') return async () => 0;
        if (prop.startsWith('$')) return async () => {};

        let delegate = delegates.get(prop);
        if (!delegate) delegates.set(prop, (delegate = createModelDelegate(prop)));
        return delegate;
      }
    });

    return client;
  }
}

export let installPrismaStub = () => {
  if ((globalThis as any)[pluginStateKey] || typeof Bun == 'undefined') return;
  (globalThis as any)[pluginStateKey] = true;
  (globalThis as any)[offlinePrismaKey] = OfflinePrismaClient;

  Bun.plugin({
    name: 'lowerdeck-offline-prisma',
    setup: build => {
      build.onLoad({ filter: generatedClientFilter }, async ({ path }) => {
        let contents = await fs.readFile(path, 'utf8');

        return {
          loader: 'ts',
          contents: contents.replace(
            generatedClientExport,
            `export const PrismaClient = (globalThis as any)[Symbol.for('lowerdeck.offline.prisma')] as ReturnType<typeof $Class.getPrismaClientClass>`
          )
        };
      });
    }
  });
};
