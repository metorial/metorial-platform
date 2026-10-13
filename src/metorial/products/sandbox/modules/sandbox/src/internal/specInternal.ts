import { Service } from '@lowerdeck/service';
import { db, ID, type SandboxRegion } from '@metorial/db';
import { getRegionClient } from '../lib/regions';

let SYNC_PAGE_SIZE = 100;

class SandboxSpecInternalServiceImpl {
  async syncRegion(d: { region: SandboxRegion }) {
    let genesis = getRegionClient(d.region.id);
    let syncedAt = new Date();
    let seenGenesisIds: string[] = [];
    let after: string | undefined;

    while (true) {
      let page = await genesis.spec.list({ limit: SYNC_PAGE_SIZE, after });

      for (let item of page.items) {
        let data = {
          status: 'active' as const,
          memoryMiB: item.memoryMiB,
          vcpus: item.vcpus,
          diskBytes: 'diskBytes' in item ? item.diskBytes : null,
          lastSyncedAt: syncedAt
        };

        let spec = await db.sandboxSpec.upsert({
          where: { identifier: item.identifier },
          create: {
            id: await ID.generateId('sandboxSpec'),
            identifier: item.identifier,
            ...data
          },
          update: data
        });

        await db.sandboxSpecRegion.upsert({
          where: { specOid_regionOid: { specOid: spec.oid, regionOid: d.region.oid } },
          create: {
            id: await ID.generateId('sandboxSpecRegion'),
            genesisId: item.id,
            specOid: spec.oid,
            regionOid: d.region.oid,
            lastSyncedAt: syncedAt
          },
          update: { genesisId: item.id, status: 'active', lastSyncedAt: syncedAt }
        });

        seenGenesisIds.push(item.id);
      }

      if (!page.pagination.hasMoreAfter || !page.items.length) break;
      after = page.items[page.items.length - 1]!.id;
    }

    await db.sandboxSpecRegion.updateMany({
      where: {
        regionOid: d.region.oid,
        status: 'active',
        genesisId: { notIn: seenGenesisIds }
      },
      data: { status: 'deleted' }
    });

    await db.sandboxSpec.updateMany({
      where: { status: 'active', regions: { none: { status: 'active' } } },
      data: { status: 'deleted' }
    });
  }
}

export let sandboxSpecInternalService = Service.create(
  'sandboxSpecInternalService',
  () => new SandboxSpecInternalServiceImpl()
).build();
