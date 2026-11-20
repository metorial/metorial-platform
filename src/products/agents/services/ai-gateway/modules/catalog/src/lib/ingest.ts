import { db, getId } from '@mtsrc/ai-gateway-db';
import { Events } from '@mtsrc/ai-gateway-events';
import { supportedProviderSlugs } from '@mtsrc/ai-gateway-providers';
import type { CatalogSyncCounts } from '@mtsrc/ai-gateway-spec';
import { env } from '../env';
import { applyProjection } from './apply';
import { parseArchive } from './parse';
import { projectCatalog } from './project';
import { fetchArchive, fetchFingerprint } from './source';

export type CatalogSyncResult =
  | { status: 'unchanged' }
  | { status: 'applied'; fingerprint: string; counts: CatalogSyncCounts };

let ensureCatalogSync = async (url: string) =>
  await db.catalogSync.upsert({
    where: { url },
    create: { ...getId('catalogSync'), url },
    update: {}
  });

export let pollCatalog = async (d: { url?: string } = {}) => {
  let url = d.url ?? env.catalog.url;
  let sync = await ensureCatalogSync(url);

  let result = await fetchFingerprint({ baseUrl: url, etag: sync.etag });

  await db.catalogSync.update({
    where: { oid: sync.oid },
    data: {
      lastCheckedAt: new Date(),
      etag: result.status == 'changed' ? result.etag : undefined
    }
  });

  if (result.status == 'unchanged' || result.fingerprint == sync.fingerprint) {
    return { changed: false as const };
  }

  return { changed: true as const, fingerprint: result.fingerprint };
};

export let syncCatalog = async (
  d: { url?: string; force?: boolean } = {}
): Promise<CatalogSyncResult> => {
  let url = d.url ?? env.catalog.url;
  let sync = await ensureCatalogSync(url);

  let fingerprint = await fetchFingerprint({ baseUrl: url });
  if (fingerprint.status != 'changed') return { status: 'unchanged' };
  if (!d.force && fingerprint.fingerprint == sync.fingerprint) return { status: 'unchanged' };

  try {
    let catalog = await parseArchive(await fetchArchive(url));
    let projection = projectCatalog({ catalog, supportedProviderSlugs });
    let counts = await applyProjection(projection);

    await db.catalogSync.update({
      where: { oid: sync.oid },
      data: {
        fingerprint: fingerprint.fingerprint,
        etag: fingerprint.etag,
        counts,
        generatedAt: new Date(catalog.generatedAt),
        lastSyncedAt: new Date(),
        lastError: null
      }
    });

    await Events.fire('catalog.synced:after', { fingerprint: fingerprint.fingerprint });

    return { status: 'applied', fingerprint: fingerprint.fingerprint, counts };
  } catch (error) {
    await db.catalogSync.update({
      where: { oid: sync.oid },
      data: { lastError: error instanceof Error ? error.message : String(error) }
    });

    throw error;
  }
};
