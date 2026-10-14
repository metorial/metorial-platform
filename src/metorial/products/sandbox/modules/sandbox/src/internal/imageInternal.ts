import { Service } from '@lowerdeck/service';
import { db, ID, type SandboxMachineImageStatus, type SandboxRegion } from '@metorial/db';
import { getRegionClient } from '../lib/regions';
import { indexSandboxImageQueue } from '../queues/search';

let SYNC_PAGE_SIZE = 100;

class SandboxImageInternalServiceImpl {
  async syncRegion(d: { region: SandboxRegion }) {
    let genesis = getRegionClient(d.region.id);
    let syncedAt = new Date();
    let seenGenesisIds: string[] = [];
    let after: string | undefined;

    while (true) {
      let page = await genesis.globalMachineImage.list({
        imported: true,
        status: ['ready'],
        limit: SYNC_PAGE_SIZE,
        after
      });

      for (let item of page.items) {
        if (!item.identifier || !item.currentVersion) continue;

        await this.syncImage({
          region: d.region,
          genesis,
          syncedAt,
          item: {
            ...item,
            identifier: item.identifier,
            currentVersionId: item.currentVersion.id
          }
        });

        seenGenesisIds.push(item.id);
      }

      if (!page.pagination.hasMoreAfter || !page.items.length) break;
      after = page.items[page.items.length - 1]!.id;
    }

    await db.sandboxMachineImageRegion.updateMany({
      where: {
        regionOid: d.region.oid,
        status: 'active',
        genesisId: { notIn: seenGenesisIds },
        image: { instanceOid: null }
      },
      data: { status: 'deleted' }
    });

    await db.sandboxMachineImageVersionRegion.updateMany({
      where: {
        regionOid: d.region.oid,
        status: 'active',
        imageRegion: { status: 'deleted' }
      },
      data: { status: 'deleted' }
    });

    await this.refreshAvailability();
  }

  async refreshAvailability() {
    let regions = await db.sandboxRegion.findMany({
      where: { status: 'active' },
      select: { oid: true }
    });
    if (!regions.length) return;

    let regionOids = regions.map(region => region.oid);
    let activeInRegions = { status: 'active' as const, regionOid: { in: regionOids } };

    let images = await db.sandboxMachineImage.findMany({
      where: { OR: [{ instanceOid: null }, { status: { not: 'deleted' } }] },
      select: {
        oid: true,
        status: true,
        instanceOid: true,
        _count: { select: { regions: { where: activeInRegions } } }
      }
    });

    for (let status of ['pending', 'active', 'deleted'] as const) {
      let oids = images
        .filter(
          image =>
            image.status != status &&
            this.availability({
              presentRegions: image._count.regions,
              activeRegions: regionOids.length,
              isGlobal: image.instanceOid === null
            }) == status
        )
        .map(image => image.oid);
      if (!oids.length) continue;

      await db.sandboxMachineImage.updateMany({
        where: { oid: { in: oids } },
        data: { status, deletedAt: status == 'deleted' ? new Date() : null }
      });
    }

    let versions = await db.sandboxMachineImageVersion.findMany({
      where: { OR: [{ image: { instanceOid: null } }, { status: { not: 'deleted' } }] },
      select: {
        oid: true,
        status: true,
        image: { select: { instanceOid: true } },
        _count: { select: { regions: { where: activeInRegions } } }
      }
    });

    for (let status of ['pending', 'active', 'deleted'] as const) {
      let oids = versions
        .filter(
          version =>
            version.status != status &&
            this.availability({
              presentRegions: version._count.regions,
              activeRegions: regionOids.length,
              isGlobal: version.image.instanceOid === null
            }) == status
        )
        .map(version => version.oid);
      if (!oids.length) continue;

      await db.sandboxMachineImageVersion.updateMany({
        where: { oid: { in: oids } },
        data: { status }
      });
    }
  }

  private availability(d: {
    presentRegions: number;
    activeRegions: number;
    isGlobal: boolean;
  }): SandboxMachineImageStatus {
    if (d.presentRegions == 0) return d.isGlobal ? 'deleted' : 'pending';
    if (d.presentRegions >= d.activeRegions) return 'active';

    return 'pending';
  }

  private async syncImage(d: {
    region: SandboxRegion;
    genesis: ReturnType<typeof getRegionClient>;
    syncedAt: Date;
    item: { id: string; identifier: string; name: string | null; currentVersionId: string };
  }) {
    let existing = await db.sandboxMachineImage.findUnique({
      where: { identifier: d.item.identifier },
      select: { name: true }
    });

    let image = await db.sandboxMachineImage.upsert({
      where: { identifier: d.item.identifier },
      create: {
        id: await ID.generateId('sandboxMachineImage'),
        identifier: d.item.identifier,
        name: d.item.name,
        lastSyncedAt: d.syncedAt
      },
      update: { name: d.item.name, lastSyncedAt: d.syncedAt }
    });

    if (!existing || existing.name != d.item.name) {
      await indexSandboxImageQueue.add({ imageOid: image.oid.toString() });
    }

    let imageRegion = await db.sandboxMachineImageRegion.upsert({
      where: { imageOid_regionOid: { imageOid: image.oid, regionOid: d.region.oid } },
      create: {
        id: await ID.generateId('sandboxMachineImageRegion'),
        genesisId: d.item.id,
        imageOid: image.oid,
        regionOid: d.region.oid,
        lastSyncedAt: d.syncedAt
      },
      update: { genesisId: d.item.id, status: 'active', lastSyncedAt: d.syncedAt }
    });

    let knownCurrentVersion = await db.sandboxMachineImageVersionRegion.findFirst({
      where: {
        regionOid: d.region.oid,
        genesisId: d.item.currentVersionId,
        imageRegionOid: imageRegion.oid,
        status: 'active'
      },
      select: { oid: true }
    });
    if (knownCurrentVersion) return;

    await this.syncVersions({
      region: d.region,
      genesis: d.genesis,
      syncedAt: d.syncedAt,
      image,
      imageRegion,
      genesisImageId: d.item.id
    });
  }

  private async syncVersions(d: {
    region: SandboxRegion;
    genesis: ReturnType<typeof getRegionClient>;
    syncedAt: Date;
    image: { oid: bigint };
    imageRegion: { oid: bigint };
    genesisImageId: string;
  }) {
    let seenGenesisIds: string[] = [];
    let after: string | undefined;

    while (true) {
      let page = await d.genesis.globalMachineImage.version.list({
        imageId: d.genesisImageId,
        status: ['active'],
        limit: SYNC_PAGE_SIZE,
        after
      });

      for (let item of page.items) {
        if (!item.releaseKey) continue;

        let version = await db.sandboxMachineImageVersion.upsert({
          where: {
            imageOid_releaseKey: { imageOid: d.image.oid, releaseKey: item.releaseKey }
          },
          create: {
            id: await ID.generateId('sandboxMachineImageVersion'),
            imageOid: d.image.oid,
            releaseKey: item.releaseKey,
            lastSyncedAt: d.syncedAt
          },
          update: { lastSyncedAt: d.syncedAt }
        });

        await db.sandboxMachineImageVersionRegion.upsert({
          where: {
            versionOid_regionOid: { versionOid: version.oid, regionOid: d.region.oid }
          },
          create: {
            id: await ID.generateId('sandboxMachineImageVersionRegion'),
            genesisId: item.id,
            digest: item.digest,
            versionOid: version.oid,
            imageRegionOid: d.imageRegion.oid,
            regionOid: d.region.oid,
            lastSyncedAt: d.syncedAt
          },
          update: {
            genesisId: item.id,
            digest: item.digest,
            imageRegionOid: d.imageRegion.oid,
            status: 'active',
            lastSyncedAt: d.syncedAt
          }
        });

        seenGenesisIds.push(item.id);
      }

      if (!page.pagination.hasMoreAfter || !page.items.length) break;
      after = page.items[page.items.length - 1]!.id;
    }

    await db.sandboxMachineImageVersionRegion.updateMany({
      where: {
        imageRegionOid: d.imageRegion.oid,
        status: 'active',
        genesisId: { notIn: seenGenesisIds }
      },
      data: { status: 'deleted' }
    });
  }
}

export let sandboxImageInternalService = Service.create(
  'sandboxImageInternalService',
  () => new SandboxImageInternalServiceImpl()
).build();
