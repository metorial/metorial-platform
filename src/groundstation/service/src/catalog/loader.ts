import { readFile } from 'node:fs/promises';
import { v } from '@lowerdeck/validation';
import type { Catalog } from '@metorial/model-catalog/src/types';
import { env } from '../env';
import { createCatalogIndex, type CatalogIndex } from './lookup';

let refreshIntervalMs = 60 * 60 * 1000;
let retryIntervalMs = 5 * 60 * 1000;
let fetchTimeoutMs = 30_000;

let catalogSchema = v.object({
  schemaVersion: v.literal(1),
  generatedAt: v.string(),
  models: v.array(v.any()),
  pointers: v.array(v.any()),
  families: v.array(v.any()),
  vendors: v.array(v.any()),
  offerings: v.array(v.any()),
  names: v.array(v.any())
});

export let readCatalog = async (location: string): Promise<Catalog> => {
  let text: string;

  if (/^https?:\/\//.test(location)) {
    let response = await fetch(location, { signal: AbortSignal.timeout(fetchTimeoutMs) });
    if (!response.ok) throw new Error(`Model catalog request failed with ${response.status}.`);

    text = await response.text();
  } else {
    text = await readFile(location.replace(/^file:\/\//, ''), 'utf8');
  }

  let parsed = JSON.parse(text);

  let validated = catalogSchema.validate(parsed);
  if (!validated.success) throw new Error('The model catalog has an unexpected shape.');

  return parsed as Catalog;
};

export type CatalogLoader = { get: () => Promise<CatalogIndex | null> };

// Keeps the last catalog that loaded; a failed refresh is retried later without dropping it.
export let createCatalogLoader = (d: {
  location: string | undefined;
  read?: (location: string) => Promise<Catalog>;
  now?: () => number;
}): CatalogLoader => {
  let read = d.read ?? readCatalog;
  let now = d.now ?? Date.now;

  let index: CatalogIndex | null = null;
  let loadedAt = 0;
  let failedAt = -Infinity;
  let loading: Promise<void> | null = null;

  let load = (location: string) =>
    (loading ??= read(location)
      .then(catalog => {
        index = createCatalogIndex(catalog);
        loadedAt = now();
      })
      .catch(error => {
        failedAt = now();
        console.warn('[groundstation] model catalog could not be loaded', error);
      })
      .finally(() => {
        loading = null;
      }));

  return {
    get: async () => {
      if (!d.location) return null;

      let time = now();
      let retryDue = time - failedAt >= retryIntervalMs;

      if (index) {
        if (time - loadedAt >= refreshIntervalMs && retryDue) void load(d.location);

        return index;
      }

      if (retryDue) await load(d.location);

      return index;
    }
  };
};

let current: CatalogLoader | undefined;

export let getCatalog = () =>
  (current ??= createCatalogLoader({ location: env.catalog.url })).get();

export let modelFamily = async (modelId: string) =>
  (await getCatalog())?.modelInfo(modelId)?.familyId ?? modelId;
