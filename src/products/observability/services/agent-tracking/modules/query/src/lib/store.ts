import { preconditionFailedError, ServiceError } from '@lowerdeck/error';
import {
  getStore,
  isStoreConfigured,
  UnsupportedStoreVersionError
} from '@mtsrc/agent-tracking-store';
import type { DatasetDef } from '../catalog';
import { assertScoped, type EffectiveScope, type Stage } from './scope';

export let queryTimeoutMs = 30_000;

export let storeCollections = async () => {
  if (!isStoreConfigured()) {
    throw new ServiceError(
      preconditionFailedError({ message: 'Queries need the record store.' })
    );
  }

  let store = getStore();
  await store.ready();

  try {
    await store.assertQuerySupport();
  } catch (error) {
    if (error instanceof UnsupportedStoreVersionError) {
      throw new ServiceError(preconditionFailedError({ message: error.message }));
    }
    throw error;
  }

  return store.collections();
};

export type Collections = Awaited<ReturnType<typeof storeCollections>>;

// Every pipeline goes through here, so none reaches Mongo without its tenancy match (11 §8.2).
export let runPipeline = async <T>(d: {
  collections: Collections;
  dataset: DatasetDef;
  scope: EffectiveScope;
  pipeline: Stage[];
}) => {
  let pipeline = assertScoped(d.pipeline, d.dataset, d.scope);
  let collection = d.collections[d.dataset.collection] as unknown as {
    aggregate: (
      pipeline: Stage[],
      options: { maxTimeMS: number; allowDiskUse: boolean }
    ) => { toArray: () => Promise<T[]> };
  };

  return collection
    .aggregate(pipeline, { maxTimeMS: queryTimeoutMs, allowDiskUse: false })
    .toArray();
};
