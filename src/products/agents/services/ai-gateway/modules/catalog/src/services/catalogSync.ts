import { Service } from '@lowerdeck/service';
import { db } from '@mtsrc/ai-gateway-db';
import { env } from '../env';
import { pollCatalog, syncCatalog } from '../lib/ingest';
import { queueCatalogIngest } from '../queues/catalogSync';

class CatalogSyncServiceImpl {
  async sync(d: { url?: string; force?: boolean } = {}) {
    return await syncCatalog(d);
  }

  async poll(d: { url?: string } = {}) {
    return await pollCatalog(d);
  }

  async requestSync() {
    await queueCatalogIngest(`manual-${Date.now()}`);
  }

  async getStatus() {
    return await db.catalogSync.findUnique({ where: { url: env.catalog.url } });
  }
}

export let catalogSyncService = Service.create(
  'catalogSyncService',
  () => new CatalogSyncServiceImpl()
).build();
