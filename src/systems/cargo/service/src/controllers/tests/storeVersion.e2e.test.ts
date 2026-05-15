import { flushDocumentDraft } from '@metorial-cargo/module-doc';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../db';
import { storeVersionService } from '@metorial-cargo/module-store';
import { cargoClient } from '../../test/client';
import { cleanDatabase } from '../../test/setup';

let subtractHours = (date: Date, hours: number) =>
  new Date(date.getTime() - hours * 60 * 60 * 1000);

let createScope = async () => {
  let tenant = await cargoClient.tenant.upsert({
    identifier: 'tenant-store-versions',
    name: 'Tenant Store Versions'
  });

  let environment = await cargoClient.environment.upsert({
    tenantId: tenant.id,
    identifier: 'prod',
    name: 'Production',
    type: 'production'
  });

  return {
    tenant,
    environment
  };
};

let createPurpose = async () =>
  await cargoClient.filePurpose.upsert({
    slug: 'store_version_assets',
    name: 'Store Version Assets',
    ownerType: 'organization',
    canHaveLinks: true
  });

let createFile = async (d: {
  tenantId: string;
  environmentId: string;
  purposeId: string;
  id?: string;
  storeId: string;
  name: string;
}) =>
  await cargoClient.file.create({
    tenantId: d.tenantId,
    environmentId: d.environmentId,
    fileId: d.id,
    purpose: d.purposeId,
    storeId: d.storeId,
    name: d.name,
    mimeType: 'image/png',
    size: 128,
    title: d.name
  });

let flushDocument = async (documentId: string) =>
  await flushDocumentDraft({
    documentId,
    force: true
  });

describe('cargo storeVersion.e2e', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it('marks stores dirty once for direct item changes', async () => {
    let { tenant, environment } = await createScope();
    let purpose = await createPurpose();
    let firstFile = await createFile({
      tenantId: tenant.id,
      environmentId: environment.id,
      purposeId: purpose.id,
      id: 'cfi_store_version_dirty_1',
      storeId: 'store-version-dirty-1',
      name: 'avatar-1.png'
    });
    let secondFile = await createFile({
      tenantId: tenant.id,
      environmentId: environment.id,
      purposeId: purpose.id,
      id: 'cfi_store_version_dirty_2',
      storeId: 'store-version-dirty-2',
      name: 'avatar-2.png'
    });
    let store = await cargoClient.store.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: 'cst_store_version_dirty',
      name: 'Dirty Store'
    });

    await cargoClient.store.modifyItems({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: store.id,
      operations: [
        {
          fileId: firstFile.id,
          path: '/assets/avatar.png'
        }
      ]
    });

    let firstDirtyStore = await db.store.findUnique({
      where: {
        id: store.id
      }
    });

    expect(firstDirtyStore?.dirtyAt).toBeTruthy();

    await cargoClient.store.modifyItems({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: store.id,
      operations: [
        {
          fileId: secondFile.id,
          path: '/assets/avatar-2.png'
        }
      ]
    });

    let secondDirtyStore = await db.store.findUnique({
      where: {
        id: store.id
      }
    });

    expect(secondDirtyStore?.dirtyAt?.toISOString()).toBe(
      firstDirtyStore?.dirtyAt?.toISOString()
    );
  });

  it('marks linked stores dirty when document versions are created without overwriting dirtyAt', async () => {
    let { tenant, environment } = await createScope();
    let store = await cargoClient.store.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: 'cst_store_version_doc_dirty',
      name: 'Document Dirty Store'
    });
    let created = await cargoClient.document.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      title: 'Readme',
      content: 'hello world',
      store: {
        id: store.id,
        path: '/docs/readme.md'
      }
    });

    await db.store.update({
      where: {
        id: store.id
      },
      data: {
        dirtyAt: null
      }
    });

    let documentRecord = await db.document.findUnique({
      where: {
        id: created.id
      }
    });

    await db.documentVersion.update({
      where: {
        oid: documentRecord!.currentVersionOid!
      },
      data: {
        createdAt: subtractHours(new Date(), 4)
      }
    });

    await cargoClient.document.update({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: created.id,
      content: 'hello world v2'
    });
    await flushDocument(created.id);

    let firstDirtyStore = await db.store.findUnique({
      where: {
        id: store.id
      }
    });

    expect(firstDirtyStore?.dirtyAt).toBeTruthy();

    let updatedDocument = await db.document.findUnique({
      where: {
        id: created.id
      }
    });

    await db.documentVersion.update({
      where: {
        oid: updatedDocument!.currentVersionOid!
      },
      data: {
        createdAt: subtractHours(new Date(), 4)
      }
    });

    await cargoClient.document.update({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: created.id,
      content: 'hello world v3'
    });
    await flushDocument(created.id);

    let secondDirtyStore = await db.store.findUnique({
      where: {
        id: store.id
      }
    });

    expect(secondDirtyStore?.dirtyAt?.toISOString()).toBe(
      firstDirtyStore?.dirtyAt?.toISOString()
    );
  });

  it('lists stores ready for versioning and snapshots document version ids', async () => {
    let { tenant, environment } = await createScope();
    let purpose = await createPurpose();
    let file = await createFile({
      tenantId: tenant.id,
      environmentId: environment.id,
      purposeId: purpose.id,
      id: 'cfi_store_version_snapshot_file',
      storeId: 'store-version-snapshot-file',
      name: 'logo.png'
    });
    let readyStore = await cargoClient.store.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: 'cst_store_version_ready',
      name: 'Ready Store'
    });
    let waitingStore = await cargoClient.store.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: 'cst_store_version_waiting',
      name: 'Waiting Store'
    });
    let document = await cargoClient.document.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      title: 'Guide',
      content: 'snapshot me',
      store: {
        id: readyStore.id,
        path: '/docs/guide.md'
      }
    });

    await cargoClient.store.modifyItems({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: readyStore.id,
      operations: [
        {
          fileId: file.id,
          path: '/assets/logo.png'
        }
      ]
    });

    let documentRecord = await db.document.findUnique({
      where: {
        id: document.id
      },
      include: {
        currentVersion: true
      }
    });

    let staleDirtyAt = subtractHours(new Date(), 2);
    let tenantRecord = (await db.tenant.findUnique({
      where: {
        id: tenant.id
      },
      select: {
        id: true,
        oid: true
      }
    }))!;
    let environmentRecord = (await db.environment.findUnique({
      where: {
        id: environment.id
      },
      select: {
        id: true,
        oid: true
      }
    }))!;

    await db.store.update({
      where: {
        id: readyStore.id
      },
      data: {
        dirtyAt: staleDirtyAt
      }
    });
    await db.store.update({
      where: {
        id: waitingStore.id
      },
      data: {
        dirtyAt: subtractHours(new Date(), 0.5)
      }
    });

    let readyStores = await db.store.findMany({
      where: {
        dirtyAt: {
          not: null,
          lte: subtractHours(new Date(), 1)
        }
      },
      orderBy: {
        oid: 'asc'
      },
      take: 10,
      select: {
        id: true,
        dirtyAt: true
      }
    });

    expect(
      readyStores.map(store => ({
        storeId: store.id,
        dirtyAt: store.dirtyAt
      }))
    ).toEqual([
      {
        storeId: readyStore.id,
        dirtyAt: staleDirtyAt
      }
    ]);

    let snapshotResult = await storeVersionService.createStoreVersionSnapshot({
      storeId: readyStore.id,
      expectedDirtyAt: staleDirtyAt
    });

    expect(snapshotResult?.alreadyExisted).toBe(false);
    expect(snapshotResult?.didClearDirtyAt).toBe(true);
    expect(snapshotResult?.version).toMatchObject({
      kind: 'snapshot',
      storeId: readyStore.id,
      versionNumber: 1,
      itemCount: 5
    });

    let documentSnapshotItem = snapshotResult!.version.items.find(
      item => item.documentId === document.id
    );
    let directorySnapshotItem = snapshotResult!.version.items.find(
      item => item.path === '/docs/'
    );

    expect(documentSnapshotItem?.documentVersionId).toBe(documentRecord?.currentVersion?.id);
    expect(directorySnapshotItem?.kind).toBe('directory');

    let listedVersions = await (
      await storeVersionService.listStoreVersions({
        tenant: tenantRecord,
        environment: environmentRecord,
        storeId: readyStore.id
      })
    ).run({
      limit: 10
    });

    expect(listedVersions.items).toHaveLength(1);
    expect(listedVersions.items[0]?.id).toBe(snapshotResult?.version.id);

    let latestVersion = await storeVersionService.getResolvedStoreVersion({
      tenant: tenantRecord,
      environment: environmentRecord,
      storeId: readyStore.id,
      storeVersionId: 'latest'
    });

    expect(latestVersion).toMatchObject({
      id: 'latest',
      kind: 'latest',
      storeId: readyStore.id,
      itemCount: 5
    });
    expect(latestVersion.items.find(item => item.path === '/')?.kind).toBe('directory');

    let refreshedReadyStore = await db.store.findUnique({
      where: {
        id: readyStore.id
      }
    });
    let refreshedWaitingStore = await db.store.findUnique({
      where: {
        id: waitingStore.id
      }
    });

    expect(refreshedReadyStore?.dirtyAt).toBeNull();
    expect(refreshedWaitingStore?.dirtyAt).toBeTruthy();
  });

  it('keeps dirtyAt when live store state has moved past the snapshot start', async () => {
    let { tenant, environment } = await createScope();
    let purpose = await createPurpose();
    let file = await createFile({
      tenantId: tenant.id,
      environmentId: environment.id,
      purposeId: purpose.id,
      id: 'cfi_store_version_race_file',
      storeId: 'store-version-race-file',
      name: 'banner.png'
    });
    let store = await cargoClient.store.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: 'cst_store_version_race',
      name: 'Race Store'
    });

    let added = await cargoClient.store.modifyItems({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: store.id,
      operations: [
        {
          fileId: file.id,
          path: '/assets/banner.png'
        }
      ]
    });

    let staleDirtyAt = subtractHours(new Date(), 2);

    await db.store.update({
      where: {
        id: store.id
      },
      data: {
        dirtyAt: staleDirtyAt
      }
    });
    await db.storeItem.update({
      where: {
        id: added[0]!.item.id
      },
      data: {
        updatedAt: new Date(Date.now() + 60_000)
      }
    });

    let snapshotResult = await storeVersionService.createStoreVersionSnapshot({
      storeId: store.id,
      expectedDirtyAt: staleDirtyAt
    });

    expect(snapshotResult?.version.versionNumber).toBe(1);
    expect(snapshotResult?.didClearDirtyAt).toBe(false);

    let refreshedStore = await db.store.findUnique({
      where: {
        id: store.id
      }
    });

    expect(refreshedStore?.dirtyAt?.toISOString()).toBe(staleDirtyAt.toISOString());
  });
});
