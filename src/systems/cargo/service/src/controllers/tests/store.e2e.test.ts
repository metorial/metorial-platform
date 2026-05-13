import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../db';
import { getCargoFilesBucketName, getStorage } from '../../storage';
import {
  documentService,
  storeService,
  storeTemplateService,
  storeTemplateSyncService
} from '../../services';
import { cargoClient } from '../../test/client';
import { cleanDatabase } from '../../test/setup';

let subtractHours = (date: Date, hours: number) =>
  new Date(date.getTime() - hours * 60 * 60 * 1000);

let createScope = async () => {
  let tenant = await cargoClient.tenant.upsert({
    identifier: 'tenant-stores',
    name: 'Tenant Stores'
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
    slug: 'organization_image_store',
    name: 'Organization Image Store',
    ownerType: 'organization',
    canHaveLinks: true
  });

let createActor = async (
  tenantId: string,
  d: {
    identifier: string;
    name: string;
  }
) =>
  await cargoClient.actor.upsert({
    tenantId,
    identifier: d.identifier,
    name: d.name
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

let listStoreItemReferences = async (d: {
  tenantId: string;
  environmentId: string;
  itemId: string;
}) =>
  await cargoClient.fileReference.list({
    tenantId: d.tenantId,
    environmentId: d.environmentId,
    entityType: 'store_item',
    entityId: d.itemId,
    limit: 20
  });

let syncChildVersions = async (parentDocumentVersionId: string, limit = 100) => {
  let cursor: string | undefined;
  let downstreamVersionIds: string[] = [];

  while (true) {
    let result = await documentService.listSyncableChildDocumentIdsForVersionSync({
      parentDocumentVersionId,
      cursor,
      limit
    });

    for (let childDocumentId of result.childDocumentIds) {
      let syncResult = await documentService.syncChildDocumentVersionFromParentVersion({
        parentDocumentVersionId,
        childDocumentId
      });

      if (syncResult?.createdVersionId) {
        downstreamVersionIds.push(syncResult.createdVersionId);
      }
    }

    if (!result.nextCursor) break;

    cursor = result.nextCursor;
  }

  for (let downstreamVersionId of downstreamVersionIds) {
    await syncChildVersions(downstreamVersionId, limit);
  }
};

let syncStandaloneTemplate = async (storeTemplateId: string) => {
  let template = await db.storeTemplate.findUniqueOrThrow({
    where: {
      id: storeTemplateId
    },
    include: {
      items: true
    }
  });

  for (let item of template.items) {
    await storeTemplateSyncService.refreshStoreTemplateItemHash({
      storeTemplateItemId: item.id
    });
  }

  let hashResult = await storeTemplateSyncService.refreshStoreTemplateHash({
    storeTemplateId,
    forceFullReconcile: true
  });
  expect(hashResult.missingItemIds).toEqual([]);

  let cursorOid: string | undefined;
  while (true) {
    let targets = await storeTemplateSyncService.listStoreTemplateSyncTargets({
      storeTemplateId,
      cursorOid,
      limit: 100
    });

    for (let target of targets.targets) {
      await storeTemplateSyncService.syncStoreTemplateBackingStore({
        storeTemplateId,
        tenantId: target.tenant.id,
        environmentId: target.environment.id,
        forceFullReconcile: true
      });
    }

    if (!targets.nextCursorOid) break;
    cursorOid = targets.nextCursorOid;
  }
};

describe('cargo store.e2e', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it('creates, lists, gets, updates, and deletes stores', async () => {
    let { tenant, environment } = await createScope();

    let created = await cargoClient.store.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      name: 'Assets'
    });

    let listed = await cargoClient.store.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      limit: 10
    });

    let fetched = await cargoClient.store.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: created.id
    });

    let updated = await cargoClient.store.update({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: created.id,
      name: 'Brand Assets',
      access: 'public_read'
    });

    let deleted = await cargoClient.store.delete({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: created.id
    });

    let listedAfterDelete = await cargoClient.store.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      limit: 10
    });

    expect(created).toMatchObject({
      id: expect.any(String),
      name: 'Assets',
      access: 'private',
      itemCount: 1
    });
    expect(listed.items).toHaveLength(1);
    expect(fetched.id).toBe(created.id);
    expect(fetched.itemCount).toBe(1);
    expect(fetched.access).toBe('private');
    expect(updated.name).toBe('Brand Assets');
    expect(updated.access).toBe('public_read');
    expect(deleted.id).toBe(created.id);
    expect(listedAfterDelete.items).toHaveLength(0);
  });

  it('persists store creators as writable participants when created with actorId', async () => {
    let { tenant, environment } = await createScope();
    let actor = await createActor(tenant.id, {
      identifier: 'store-creator',
      name: 'Store Creator'
    });

    let created = await cargoClient.store.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      actorId: actor.id,
      name: 'Actor Owned Store'
    });

    let createdStoreRecord = await db.store.findUnique({
      where: {
        id: created.id
      }
    });
    let participant = await db.storeParticipant.findFirst({
      where: {
        store: {
          id: created.id
        },
        tenantActor: {
          id: actor.id
        }
      }
    });

    expect(createdStoreRecord?.createdByTenantActorOid).toBeTruthy();
    expect(participant?.permissions).toEqual(['content_read', 'content_write']);
  });

  it('clones a store by reusing file items and duplicating document items at the same paths', async () => {
    let { tenant, environment } = await createScope();
    let purpose = await createPurpose();
    let sourceStore = await cargoClient.store.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: 'cst_store_source_clone',
      name: 'Source Store'
    });
    let file = await createFile({
      tenantId: tenant.id,
      environmentId: environment.id,
      purposeId: purpose.id,
      id: 'cfi_store_clone_file',
      storeId: 'store-clone-file',
      name: 'logo.png'
    });
    let document = await cargoClient.document.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      title: 'Readme',
      content: 'clone me'
    });

    await cargoClient.store.modifyItems({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: sourceStore.id,
      operations: [
        {
          fileId: file.id,
          path: '/assets/logo.png'
        },
        {
          documentId: document.id,
          path: '/docs/readme.md'
        }
      ]
    });

    let clonedStore = await cargoClient.store.clone({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: sourceStore.id,
      targetStoreId: 'cst_store_cloned',
      name: 'Cloned Store',
      cloneType: 'sync_until_change'
    });

    let sourceItems = await cargoClient.storeItem.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: sourceStore.id,
      limit: 10
    });
    let clonedItems = await cargoClient.storeItem.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: clonedStore.id,
      limit: 10
    });
    let clonedFileItem = clonedItems.items.find(item => item.path === '/assets/logo.png');
    let clonedDocumentItem = clonedItems.items.find(item => item.path === '/docs/readme.md');
    let sourceDocumentItem = sourceItems.items.find(item => item.path === '/docs/readme.md');
    let clonedDocument = await cargoClient.document.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: clonedDocumentItem!.documentId!
    });
    let clonedDocumentRecord = await db.document.findUnique({
      where: {
        id: clonedDocument.id
      }
    });
    let sourceStoreRecord = await db.store.findUnique({
      where: {
        id: sourceStore.id
      }
    });
    let clonedStoreRecord = await db.store.findUnique({
      where: {
        id: clonedStore.id
      }
    });
    let sourceDocumentRecord = await db.document.findUnique({
      where: {
        id: document.id
      }
    });

    expect(clonedStore).toMatchObject({
      id: 'cst_store_cloned',
      name: 'Cloned Store',
      cloneType: 'sync_until_change',
      itemCount: 5
    });
    expect(clonedItems.items.map(item => item.path).sort()).toEqual(
      sourceItems.items.map(item => item.path).sort()
    );
    expect(clonedFileItem).toMatchObject({
      fileId: file.id,
      documentId: undefined,
      path: '/assets/logo.png'
    });
    expect(clonedDocumentItem).toMatchObject({
      path: '/docs/readme.md'
    });
    expect(clonedDocumentItem?.documentId).toBeTruthy();
    expect(clonedDocumentItem?.documentId).not.toBe(document.id);
    expect(clonedDocumentItem?.fileId).not.toBe(sourceDocumentItem?.fileId);
    expect(clonedDocument).toMatchObject({
      title: document.title,
      content: document.content
    });
    expect(clonedStoreRecord?.parentStoreOid).toBe(sourceStoreRecord?.oid);
    expect(clonedStoreRecord?.cloneType).toBe('sync_until_change');
    expect(clonedDocumentRecord?.parentDocumentOid).toBe(sourceDocumentRecord?.oid);
  });

  it('skips cloned directory items when the source directory record is missing', async () => {
    let { tenant, environment } = await createScope();
    let sourceStore = await cargoClient.store.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: 'cst_store_orphaned_directory_source',
      name: 'Source Store'
    });

    let createdDirectory = await cargoClient.store.modifyItems({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: sourceStore.id,
      operations: [
        {
          path: '/orphaned/'
        }
      ]
    });
    let sourceStoreRecord = (await db.store.findUnique({
      where: {
        id: sourceStore.id
      }
    }))!;
    let sourceDirectory = (await db.storeDirectory.findFirst({
      where: {
        storeOid: sourceStoreRecord.oid,
        path: '/orphaned/'
      }
    }))!;

    await db.storeItem.update({
      where: {
        id: createdDirectory[0]!.item.id
      },
      data: {
        directoryOid: null
      }
    });
    await db.storeDirectory.delete({
      where: {
        id: sourceDirectory.id
      }
    });

    let clonedStore = await cargoClient.store.clone({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: sourceStore.id,
      targetStoreId: 'cst_store_orphaned_directory_clone',
      name: 'Cloned Store',
      cloneType: 'sync_until_change'
    });
    let clonedItems = await cargoClient.storeItem.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: clonedStore.id,
      types: ['directory'],
      limit: 10
    });

    expect(clonedItems.items.map(item => item.path)).toEqual(['/']);
    expect(clonedStore.itemCount).toBe(1);
  });

  it('keeps sync-until-change store clones linked while duplicate clones stay detached', async () => {
    let { tenant, environment } = await createScope();
    let sourceStore = await cargoClient.store.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: 'cst_store_source_clone_modes',
      name: 'Source Store'
    });
    let sourceDocument = await cargoClient.document.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      title: 'Readme',
      content: 'v1'
    });

    await cargoClient.store.modifyItems({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: sourceStore.id,
      operations: [
        {
          documentId: sourceDocument.id,
          path: '/docs/readme.md'
        }
      ]
    });

    let syncCloneStore = await cargoClient.store.clone({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: sourceStore.id,
      targetStoreId: 'cst_store_sync_clone',
      name: 'Sync Clone',
      cloneType: 'sync_until_change'
    });
    let duplicateCloneStore = await cargoClient.store.clone({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: sourceStore.id,
      targetStoreId: 'cst_store_duplicate_clone',
      name: 'Duplicate Clone',
      cloneType: 'duplicate'
    });

    let syncCloneItems = await cargoClient.storeItem.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: syncCloneStore.id,
      limit: 10
    });
    let duplicateCloneItems = await cargoClient.storeItem.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: duplicateCloneStore.id,
      limit: 10
    });
    let syncCloneDocumentId = syncCloneItems.items.find(item => item.path === '/docs/readme.md')!.documentId!;
    let duplicateCloneDocumentId = duplicateCloneItems.items.find(
      item => item.path === '/docs/readme.md'
    )!.documentId!;

    let syncCloneRecordBeforeUpdate = await db.document.findUnique({
      where: {
        id: syncCloneDocumentId
      }
    });
    let duplicateCloneRecordBeforeUpdate = await db.document.findUnique({
      where: {
        id: duplicateCloneDocumentId
      }
    });

    await db.documentVersion.update({
      where: {
        id: sourceDocument.currentVersionId!
      },
      data: {
        createdAt: subtractHours(new Date(), 4)
      }
    });

    await cargoClient.document.update({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: sourceDocument.id,
      content: 'v2'
    });
    let flushedSource = await documentService.flushDocumentDraft({
      documentId: sourceDocument.id,
      force: true
    });

    await syncChildVersions(flushedSource!.currentVersion!.id);

    let syncCloneDocument = await cargoClient.document.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: syncCloneDocumentId
    });
    let duplicateCloneDocument = await cargoClient.document.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: duplicateCloneDocumentId
    });
    let syncCloneRecordAfterUpdate = await db.document.findUnique({
      where: {
        id: syncCloneDocumentId
      }
    });
    let duplicateCloneRecordAfterUpdate = await db.document.findUnique({
      where: {
        id: duplicateCloneDocumentId
      }
    });

    expect(syncCloneStore.cloneType).toBe('sync_until_change');
    expect(duplicateCloneStore.cloneType).toBe('duplicate');
    expect(syncCloneRecordBeforeUpdate?.parentDocumentOid).toBeTruthy();
    expect(syncCloneRecordBeforeUpdate?.isContentOwner).toBe(false);
    expect(duplicateCloneRecordBeforeUpdate?.parentDocumentOid).toBeNull();
    expect(duplicateCloneRecordBeforeUpdate?.isContentOwner).toBe(true);
    expect(syncCloneDocument.content).toBe('v2');
    expect(duplicateCloneDocument.content).toBe('v1');
    expect(syncCloneRecordAfterUpdate?.isContentOwner).toBe(false);
    expect(duplicateCloneRecordAfterUpdate?.isContentOwner).toBe(true);
    expect(duplicateCloneRecordAfterUpdate?.parentDocumentOid).toBeNull();
  });

  it('adds, overwrites, modifies, removes, and cleans up store items', async () => {
    let { tenant, environment } = await createScope();
    let purpose = await createPurpose();

    let firstFile = await createFile({
      tenantId: tenant.id,
      environmentId: environment.id,
      purposeId: purpose.id,
      id: 'cfi_store_file_1',
      storeId: 'store-file-1',
      name: 'avatar-1.png'
    });
    let secondFile = await createFile({
      tenantId: tenant.id,
      environmentId: environment.id,
      purposeId: purpose.id,
      id: 'cfi_store_file_2',
      storeId: 'store-file-2',
      name: 'avatar-2.png'
    });
    let document = await cargoClient.document.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      title: 'Readme',
      content: 'hello store'
    });
    let store = await cargoClient.store.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: 'cst_store_main',
      name: 'Main Store'
    });

    let fileAdd = await cargoClient.store.modifyItems({
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
    let fileItem = fileAdd[0]!.item;
    let initialFileReferenceId = fileItem.referenceId;

    let documentAdd = await cargoClient.store.modifyItems({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: store.id,
      operations: [
        {
          type: 'add',
          documentId: document.id,
          path: '/docs/readme.md'
        }
      ]
    });
    let documentItem = documentAdd[0]!.item;
    let initialDocumentReferenceId = documentItem.referenceId;

    let fetchedDocumentItem = await cargoClient.storeItem.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      itemId: documentItem.id
    });
    let listedItems = await cargoClient.storeItem.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: store.id,
      limit: 10
    });
    let storeAfterAdds = await cargoClient.store.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: store.id
    });

    expect(fileItem).toMatchObject({
      path: '/assets/avatar.png',
      fileId: firstFile.id,
      documentId: undefined
    });
    expect(fetchedDocumentItem).toMatchObject({
      id: documentItem.id,
      path: '/docs/readme.md',
      fileId: document.fileId,
      documentId: document.id
    });
    expect(listedItems.items).toHaveLength(2);
    expect(listedItems.items.map(item => item.path).sort()).toEqual([
      '/assets/avatar.png',
      '/docs/readme.md'
    ]);
    expect(storeAfterAdds.itemCount).toBe(5);

    let modified = await cargoClient.store.modifyItems({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: store.id,
      operations: [
        {
          type: 'modify',
          itemId: fileItem.id,
          path: '/assets/avatar-updated.png',
          fileId: secondFile.id
        }
      ]
    });
    let modifiedItem = modified[0]!.item;

    expect(modifiedItem).toMatchObject({
      id: fileItem.id,
      path: '/assets/avatar-updated.png',
      fileId: secondFile.id
    });
    expect(modifiedItem.referenceId).not.toBe(initialFileReferenceId);

    let modifiedReferences = await listStoreItemReferences({
      tenantId: tenant.id,
      environmentId: environment.id,
      itemId: modifiedItem.id
    });

    expect(modifiedReferences.items).toHaveLength(1);
    expect(modifiedReferences.items[0]!.id).toBe(modifiedItem.referenceId);

    let overwritten = await cargoClient.store.modifyItems({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: store.id,
      operations: [
        {
          path: '/docs/readme.md',
          fileId: firstFile.id
        }
      ]
    });
    let overwrittenItem = overwritten[0]!.item;

    expect(overwrittenItem).toMatchObject({
      id: documentItem.id,
      path: '/docs/readme.md',
      fileId: firstFile.id,
      documentId: undefined
    });
    expect(overwrittenItem.referenceId).not.toBe(initialDocumentReferenceId);

    let overwrittenReferences = await listStoreItemReferences({
      tenantId: tenant.id,
      environmentId: environment.id,
      itemId: overwrittenItem.id
    });
    let storeAfterOverwrite = await cargoClient.store.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: store.id
    });

    expect(overwrittenReferences.items).toHaveLength(1);
    expect(overwrittenReferences.items[0]!.id).toBe(overwrittenItem.referenceId);
    expect(storeAfterOverwrite.itemCount).toBe(5);

    let removed = await cargoClient.store.modifyItems({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: store.id,
      operations: [
        {
          itemId: modifiedItem.id
        }
      ]
    });

    expect(removed[0]).toMatchObject({
      type: 'remove',
      item: {
        id: modifiedItem.id
      }
    });

    let removedReferences = await listStoreItemReferences({
      tenantId: tenant.id,
      environmentId: environment.id,
      itemId: modifiedItem.id
    });
    let itemsAfterRemove = await cargoClient.storeItem.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: store.id,
      limit: 10
    });
    let storeAfterRemove = await cargoClient.store.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: store.id
    });

    expect(removedReferences.items).toHaveLength(0);
    expect(itemsAfterRemove.items).toHaveLength(1);
    expect(itemsAfterRemove.items[0]!.id).toBe(overwrittenItem.id);
    expect(storeAfterRemove.itemCount).toBe(3);

    await cargoClient.store.delete({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: store.id
    });

    let referencesAfterDelete = await cargoClient.fileReference.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      entityType: 'store_item',
      limit: 20
    });
    let itemsAfterStoreDelete = await cargoClient.storeItem.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      limit: 10
    });

    expect(referencesAfterDelete.items).toHaveLength(1);
    expect(itemsAfterStoreDelete.items).toHaveLength(0);

    await Promise.all(
      referencesAfterDelete.items.map(reference =>
        storeService.cleanupStoreFileReference({
          fileReferenceId: reference.id
        })
      )
    );

    let referencesAfterCleanup = await cargoClient.fileReference.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      entityType: 'store_item',
      limit: 20
    });

    expect(referencesAfterCleanup.items).toHaveLength(0);
  });

  it('normalizes paths and keeps explicit directories until they are explicitly removed', async () => {
    let { tenant, environment } = await createScope();
    let purpose = await createPurpose();
    let file = await createFile({
      tenantId: tenant.id,
      environmentId: environment.id,
      purposeId: purpose.id,
      id: 'cfi_store_normalized_file',
      storeId: 'store-normalized-file',
      name: 'notes.txt'
    });
    let store = await cargoClient.store.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: 'cst_store_normalized',
      name: 'Normalized Store'
    });

    let explicitDirectory = await cargoClient.store.modifyItems({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: store.id,
      operations: [
        {
          path: 'drafts/tmp'
        }
      ]
    });
    let normalizedFile = await cargoClient.store.modifyItems({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: store.id,
      operations: [
        {
          fileId: file.id,
          path: 'dir1/.././my-dir'
        }
      ]
    });

    let storeRecord = (await db.store.findUnique({
      where: {
        id: store.id
      }
    }))!;
    let directoriesAfterAdds = await db.storeDirectory.findMany({
      where: {
        storeOid: storeRecord.oid
      },
      orderBy: {
        path: 'asc'
      }
    });
    let storeItemsAfterAdds = await db.storeItem.findMany({
      where: {
        storeOid: storeRecord.oid
      },
      orderBy: {
        path: 'asc'
      }
    });
    let itemsAfterAdds = await cargoClient.storeItem.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: store.id,
      types: ['file', 'document', 'directory'],
      limit: 20
    });
    let directoryItemsOnly = await cargoClient.storeItem.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: store.id,
      types: ['directory'],
      limit: 20
    });

    expect(explicitDirectory[0]!.item).toMatchObject({
      kind: 'directory',
      path: '/drafts/tmp/'
    });
    expect(normalizedFile[0]!.item).toMatchObject({
      kind: 'file',
      path: '/dir1/my-dir'
    });
    expect(directoriesAfterAdds).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: '/', isAutoCreated: true }),
        expect.objectContaining({ path: '/drafts/', isAutoCreated: true }),
        expect.objectContaining({ path: '/drafts/tmp/', isAutoCreated: false }),
        expect.objectContaining({ path: '/dir1/', isAutoCreated: true })
      ])
    );
    expect(itemsAfterAdds.items.map(item => item.path).sort()).toEqual([
      '/',
      '/dir1/',
      '/dir1/my-dir',
      '/drafts/',
      '/drafts/tmp/'
    ]);
    expect(directoryItemsOnly.items.map(item => item.path).sort()).toEqual([
      '/',
      '/dir1/',
      '/drafts/',
      '/drafts/tmp/'
    ]);
    expect(storeItemsAfterAdds).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: '/',
          directoryOid: directoriesAfterAdds.find(directory => directory.path === '/')?.oid,
          parentDirectoryOid: null
        }),
        expect.objectContaining({
          path: '/drafts/tmp/',
          directoryOid: directoriesAfterAdds.find(directory => directory.path === '/drafts/tmp/')?.oid,
          parentDirectoryOid: directoriesAfterAdds.find(directory => directory.path === '/drafts/')?.oid
        }),
        expect.objectContaining({
          path: '/dir1/my-dir',
          directoryOid: null,
          parentDirectoryOid: directoriesAfterAdds.find(directory => directory.path === '/dir1/')?.oid
        })
      ])
    );

    await cargoClient.store.modifyItems({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: store.id,
      operations: [
        {
          itemId: normalizedFile[0]!.item.id
        }
      ]
    });

    let itemsAfterFileRemove = await cargoClient.storeItem.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: store.id,
      types: ['file', 'document', 'directory'],
      limit: 20
    });
    let directoriesAfterFileRemove = await db.storeDirectory.findMany({
      where: {
        storeOid: storeRecord.oid
      },
      orderBy: {
        path: 'asc'
      }
    });

    expect(itemsAfterFileRemove.items.map(item => item.path).sort()).toEqual([
      '/',
      '/drafts/',
      '/drafts/tmp/'
    ]);
    expect(directoriesAfterFileRemove.map(directory => directory.path).sort()).toEqual([
      '/',
      '/drafts/',
      '/drafts/tmp/'
    ]);

    await cargoClient.store.modifyItems({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: store.id,
      operations: [
        {
          itemId: explicitDirectory[0]!.item.id
        }
      ]
    });

    let itemsAfterDirectoryRemove = await cargoClient.storeItem.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: store.id,
      types: ['file', 'document', 'directory'],
      limit: 20
    });
    let directoriesAfterDirectoryRemove = await db.storeDirectory.findMany({
      where: {
        storeOid: storeRecord.oid
      },
      orderBy: {
        path: 'asc'
      }
    });
    let storeAfterDirectoryRemove = await cargoClient.store.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: store.id
    });

    expect(itemsAfterDirectoryRemove.items.map(item => item.path)).toEqual(['/']);
    expect(directoriesAfterDirectoryRemove.map(directory => directory.path)).toEqual(['/']);
    expect(storeAfterDirectoryRemove.itemCount).toBe(1);
  });

  it('keeps the root directory fixed and reserves the root path', async () => {
    let { tenant, environment } = await createScope();
    let store = await cargoClient.store.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: 'cst_store_root_guards',
      name: 'Root Guards Store'
    });

    let explicitDirectory = await cargoClient.store.modifyItems({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: store.id,
      operations: [
        {
          path: '/drafts/tmp/'
        }
      ]
    });
    let directoryItems = await cargoClient.storeItem.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: store.id,
      types: ['directory'],
      limit: 20
    });
    let rootItem = directoryItems.items.find(item => item.path === '/');

    await expect(
      cargoClient.store.modifyItems({
        tenantId: tenant.id,
        environmentId: environment.id,
        storeId: store.id,
        operations: [
          {
            type: 'modify',
            itemId: rootItem!.id
          }
        ]
      })
    ).rejects.toThrow('The root directory cannot be modified');

    await expect(
      cargoClient.store.modifyItems({
        tenantId: tenant.id,
        environmentId: environment.id,
        storeId: store.id,
        operations: [
          {
            type: 'modify',
            itemId: explicitDirectory[0]!.item.id,
            path: '/'
          }
        ]
      })
    ).rejects.toThrow('Only the root directory can use the root path');
  });

  it('rejects modify requests above the operation and item limits', async () => {
    let { tenant, environment } = await createScope();
    let purpose = await createPurpose();
    let file = await createFile({
      tenantId: tenant.id,
      environmentId: environment.id,
      purposeId: purpose.id,
      storeId: 'store-file-limit',
      name: 'limit.png'
    });
    let store = await cargoClient.store.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      name: 'Limited Store'
    });

    await expect(
      cargoClient.store.modifyItems({
        tenantId: tenant.id,
        environmentId: environment.id,
        storeId: store.id,
        operations: Array.from({ length: 501 }, (_, index) => ({
          fileId: file.id,
          path: `/too-many/${index}`
        }))
      })
    ).rejects.toThrow('A maximum of 500 store operations can be submitted at once');

    await db.store.update({
      where: {
        id: store.id
      },
      data: {
        itemCount: 1000
      }
    });

    await expect(
      cargoClient.store.modifyItems({
        tenantId: tenant.id,
        environmentId: environment.id,
        storeId: store.id,
        operations: [
          {
            fileId: file.id,
            path: '/one-too-many'
          }
        ]
      })
    ).rejects.toThrow('Store cannot contain more than 1000 items');
  });

  it('keeps private stores actor-scoped unless permissions are granted explicitly', async () => {
    let { tenant, environment } = await createScope();
    let viewer = await createActor(tenant.id, {
      identifier: 'store-viewer',
      name: 'Store Viewer'
    });
    let store = await cargoClient.store.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      name: 'Secured Store',
      access: 'private'
    });

    let readable = await cargoClient.store.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: store.id,
      actorId: viewer.id,
      defaultPermissions: ['content_read']
    });

    expect(readable.id).toBe(store.id);

    await expect(
      cargoClient.store.update({
        tenantId: tenant.id,
        environmentId: environment.id,
        storeId: store.id,
        actorId: viewer.id,
        name: 'Should Fail'
      })
    ).rejects.toThrow('Missing content_write access');

    let updated = await cargoClient.store.update({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: store.id,
      actorId: viewer.id,
      name: 'Writable Store',
      defaultPermissions: ['content_write'],
      overridePermissions: true
    });

    expect(updated.name).toBe('Writable Store');
  });

  it('allows actor-backed reads for public_read stores and creates participants', async () => {
    let { tenant, environment } = await createScope();
    let actor = await createActor(tenant.id, {
      identifier: 'public-store-reader',
      name: 'Public Store Reader'
    });
    let store = await cargoClient.store.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      name: 'Readable Store',
      access: 'public_read'
    });

    let fetched = await cargoClient.store.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: store.id,
      actorId: actor.id
    });
    let participant = await db.storeParticipant.findFirst({
      where: {
        store: {
          id: store.id
        },
        tenantActor: {
          id: actor.id
        }
      }
    });

    await expect(
      cargoClient.store.update({
        tenantId: tenant.id,
        environmentId: environment.id,
        storeId: store.id,
        actorId: actor.id,
        name: 'Should Fail'
      })
    ).rejects.toThrow('Missing content_write access');

    expect(fetched).toMatchObject({
      id: store.id,
      access: 'public_read'
    });
    expect(participant?.permissions).toEqual(['content_read']);
  });

  it('allows actor-backed writes for public_write stores and creates writable participants', async () => {
    let { tenant, environment } = await createScope();
    let purpose = await createPurpose();
    let actor = await createActor(tenant.id, {
      identifier: 'public-store-writer',
      name: 'Public Store Writer'
    });
    let file = await createFile({
      tenantId: tenant.id,
      environmentId: environment.id,
      purposeId: purpose.id,
      storeId: 'public-store-file',
      name: 'public-write.png'
    });
    let store = await cargoClient.store.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      name: 'Writable By Anyone',
      access: 'public_write'
    });

    let updated = await cargoClient.store.update({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: store.id,
      actorId: actor.id,
      name: 'Still Writable'
    });
    let added = await cargoClient.store.modifyItems({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: store.id,
      actorId: actor.id,
      operations: [
        {
          fileId: file.id,
          path: '/public-write.png'
        }
      ]
    });
    let participant = await db.storeParticipant.findFirst({
      where: {
        store: {
          id: store.id
        },
        tenantActor: {
          id: actor.id
        }
      }
    });

    expect(updated).toMatchObject({
      id: store.id,
      name: 'Still Writable',
      access: 'public_write'
    });
    expect(added[0]!.item.path).toBe('/public-write.png');
    expect(participant?.permissions).toEqual(['content_read', 'content_write']);
  });

  it('keeps no-actor requests unrestricted regardless of store access mode', async () => {
    let { tenant, environment } = await createScope();
    let privateStore = await cargoClient.store.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      name: 'No Actor Private',
      access: 'private'
    });
    let publicStore = await cargoClient.store.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      name: 'No Actor Public',
      access: 'public_write'
    });

    let privateUpdated = await cargoClient.store.update({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: privateStore.id,
      name: 'No Actor Private Updated'
    });
    let publicUpdated = await cargoClient.store.update({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: publicStore.id,
      name: 'No Actor Public Updated'
    });
    let listed = await cargoClient.store.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      limit: 10
    });

    expect(privateUpdated.name).toBe('No Actor Private Updated');
    expect(publicUpdated.name).toBe('No Actor Public Updated');
    expect(listed.items.map(store => store.id).sort()).toEqual(
      [privateStore.id, publicStore.id].sort()
    );
  });

  it('returns full permissions when no actor id is provided', async () => {
    let { tenant, environment } = await createScope();
    let store = await cargoClient.store.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      name: 'Permissioned Store',
      access: 'private'
    });
    let document = await cargoClient.document.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      title: 'Permissioned Document',
      content: 'hello world',
      store: {
        id: store.id,
        path: '/docs/permissioned.md'
      }
    });

    let storePermissions = await cargoClient.store.getPermissions({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: store.id
    });
    let documentPermissions = await cargoClient.document.getPermissions({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: document.id
    });

    expect(storePermissions).toMatchObject({
      storeId: store.id,
      actorId: null,
      hasFullAccess: true,
      permissions: ['content_read', 'content_write'],
      relevantStoreIds: [store.id],
      readableStoreIds: [store.id],
      writableStoreIds: [store.id]
    });
    expect(documentPermissions).toMatchObject({
      documentId: document.id,
      actorId: null,
      isOwner: false,
      hasFullAccess: true,
      permissions: ['content_read', 'content_write'],
      relevantStoreIds: [store.id],
      readableStoreIds: [store.id],
      writableStoreIds: [store.id]
    });
  });

  it('returns read-only store permissions regardless of baseline or actor write access', async () => {
    let { tenant, environment } = await createScope();
    let actor = await createActor(tenant.id, {
      identifier: 'readonly-permissions-writer',
      name: 'Read Only Permissions Writer'
    });
    let noActorStore = await cargoClient.store.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      name: 'Read Only No Actor',
      access: 'private'
    });
    let actorWriteStore = await cargoClient.store.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      name: 'Read Only Actor Writer',
      access: 'private'
    });
    let publicWriteStore = await cargoClient.store.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      name: 'Read Only Public Writer',
      access: 'public_write'
    });

    await cargoClient.store.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: actorWriteStore.id,
      actorId: actor.id,
      defaultPermissions: ['content_read', 'content_write'],
      overridePermissions: true
    });
    await db.store.updateMany({
      where: {
        id: {
          in: [noActorStore.id, actorWriteStore.id, publicWriteStore.id]
        }
      },
      data: {
        isReadOnly: true
      }
    });

    let noActorPermissions = await cargoClient.store.getPermissions({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: noActorStore.id
    });
    let actorWritePermissions = await cargoClient.store.getPermissions({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: actorWriteStore.id,
      actorId: actor.id
    });
    let publicWritePermissions = await cargoClient.store.getPermissions({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: publicWriteStore.id,
      actorId: actor.id
    });

    expect(noActorPermissions).toMatchObject({
      storeId: noActorStore.id,
      actorId: null,
      hasFullAccess: false,
      permissions: ['content_read'],
      relevantStoreIds: [noActorStore.id],
      readableStoreIds: [noActorStore.id],
      writableStoreIds: []
    });
    expect(actorWritePermissions).toMatchObject({
      storeId: actorWriteStore.id,
      actorId: actor.id,
      hasFullAccess: false,
      permissions: ['content_read'],
      relevantStoreIds: [actorWriteStore.id],
      readableStoreIds: [actorWriteStore.id],
      writableStoreIds: []
    });
    expect(publicWritePermissions).toMatchObject({
      storeId: publicWriteStore.id,
      actorId: actor.id,
      hasFullAccess: false,
      permissions: ['content_read'],
      relevantStoreIds: [publicWriteStore.id],
      readableStoreIds: [publicWriteStore.id],
      writableStoreIds: []
    });
  });

  it('returns actor-scoped read permissions for public_read stores and attached documents', async () => {
    let { tenant, environment } = await createScope();
    let actor = await createActor(tenant.id, {
      identifier: 'permissions-reader',
      name: 'Permissions Reader'
    });
    let store = await cargoClient.store.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      name: 'Public Permissions Store',
      access: 'public_read'
    });
    let document = await cargoClient.document.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      title: 'Public Permissions Document',
      content: 'read me',
      store: {
        id: store.id,
        path: '/docs/public-permissions.md'
      }
    });

    let storePermissions = await cargoClient.store.getPermissions({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: store.id,
      actorId: actor.id
    });
    let documentPermissions = await cargoClient.document.getPermissions({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: document.id,
      actorId: actor.id
    });
    let participant = await db.storeParticipant.findFirst({
      where: {
        store: {
          id: store.id
        },
        tenantActor: {
          id: actor.id
        }
      }
    });

    expect(storePermissions).toMatchObject({
      storeId: store.id,
      hasFullAccess: false,
      permissions: ['content_read'],
      relevantStoreIds: [store.id],
      readableStoreIds: [store.id],
      writableStoreIds: []
    });
    expect(documentPermissions).toMatchObject({
      documentId: document.id,
      isOwner: false,
      hasFullAccess: false,
      permissions: ['content_read'],
      relevantStoreIds: [store.id],
      readableStoreIds: [store.id],
      writableStoreIds: []
    });
    expect(participant?.permissions).toEqual(['content_read']);
  });

  it('enforces actor-scoped store item mutations', async () => {
    let { tenant, environment } = await createScope();
    let purpose = await createPurpose();
    let actor = await createActor(tenant.id, {
      identifier: 'store-writer',
      name: 'Store Writer'
    });
    let file = await createFile({
      tenantId: tenant.id,
      environmentId: environment.id,
      purposeId: purpose.id,
      storeId: 'store-file-write',
      name: 'writer.png'
    });
    let store = await cargoClient.store.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      name: 'Writer Store'
    });

    await expect(
      cargoClient.store.modifyItems({
        tenantId: tenant.id,
        environmentId: environment.id,
        storeId: store.id,
        actorId: actor.id,
        defaultPermissions: ['content_read'],
        operations: [
          {
            fileId: file.id,
            path: '/denied.png'
          }
        ]
      })
    ).rejects.toThrow('Missing content_write access');

    let added = await cargoClient.store.modifyItems({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: store.id,
      actorId: actor.id,
      defaultPermissions: ['content_write'],
      overridePermissions: true,
      operations: [
        {
          fileId: file.id,
          path: '/allowed.png'
        }
      ]
    });

    let itemRecord = await db.storeItem.findUnique({
      where: {
        id: added[0]!.item.id
      }
    });

    expect(added[0]!.item.path).toBe('/allowed.png');
    expect(itemRecord?.lastModifiedByTenantActorOid).toBeTruthy();
  });

  it('gets and lists store participants with an optional store filter', async () => {
    let { tenant, environment } = await createScope();
    let firstActor = await createActor(tenant.id, {
      identifier: 'participant-one',
      name: 'Participant One'
    });
    let secondActor = await createActor(tenant.id, {
      identifier: 'participant-two',
      name: 'Participant Two'
    });

    let firstStore = await cargoClient.store.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      name: 'First Store'
    });
    let secondStore = await cargoClient.store.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      name: 'Second Store'
    });

    await cargoClient.store.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: firstStore.id,
      actorId: firstActor.id,
      defaultPermissions: ['content_read']
    });
    await cargoClient.store.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: secondStore.id,
      actorId: secondActor.id,
      defaultPermissions: ['content_read', 'content_write']
    });

    let firstParticipantRecord = await db.storeParticipant.findFirst({
      where: {
        store: {
          id: firstStore.id
        },
        tenantActor: {
          id: firstActor.id
        }
      }
    });

    let fetched = await cargoClient.storeParticipant.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeParticipantId: firstParticipantRecord!.id
    });
    let listedAll = await cargoClient.storeParticipant.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      limit: 10
    });
    let listedFiltered = await cargoClient.storeParticipant.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: firstStore.id,
      limit: 10
    });

    expect(fetched).toMatchObject({
      id: firstParticipantRecord!.id,
      storeId: firstStore.id,
      permissions: ['content_read'],
      actor: {
        id: firstActor.id
      }
    });
    expect(listedAll.items).toHaveLength(2);
    expect(listedFiltered.items).toHaveLength(1);
    expect(listedFiltered.items[0]).toMatchObject({
      storeId: firstStore.id,
      actor: {
        id: firstActor.id
      }
    });
  });

  it('lists and gets global store templates from scoped reads and blocks scoped deletes', async () => {
    let { tenant, environment } = await createScope();
    let content = Buffer.from('template file payload', 'utf8').toString('base64');

    let created = await cargoClient.storeTemplate.create({
      name: 'Starter Template',
      items: [
        {
          path: '/docs/',
          type: 'directory'
        },
        {
          path: '/docs/readme.md',
          type: 'document',
          content: '# Hello Template',
          encoding: 'utf-8'
        },
        {
          path: '/logo.bin',
          type: 'file',
          content,
          encoding: 'base64'
        }
      ]
    });

    let listed = await cargoClient.storeTemplate.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      limit: 10
    });
    let fetched = await cargoClient.storeTemplate.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeTemplateId: created.id
    });

    expect(created).toMatchObject({
      id: expect.any(String),
      name: 'Starter Template',
      itemCount: 3,
      sourceStoreId: undefined
    });
    expect(created.items).toEqual([
      {
        id: expect.any(String),
        type: 'directory',
        path: '/docs/',
        content: undefined,
        encoding: undefined
      },
      {
        id: expect.any(String),
        type: 'document',
        path: '/docs/readme.md',
        content: '# Hello Template',
        encoding: 'utf-8'
      },
      {
        id: expect.any(String),
        type: 'file',
        path: '/logo.bin',
        content,
        encoding: 'base64'
      }
    ]);
    expect(listed.items).toHaveLength(1);
    expect(fetched).toMatchObject({
      id: created.id,
      itemCount: 3
    });
    await expect(
      cargoClient.storeTemplate.delete({
        tenantId: tenant.id,
        environmentId: environment.id,
        storeTemplateId: created.id
      })
    ).rejects.toThrow(
      'Store template updates and deletes are only allowed within the matching tenant and environment'
    );
  });

  it('updates and deletes scoped store templates only from the matching tenant and environment', async () => {
    let { tenant, environment } = await createScope();
    let otherTenant = await cargoClient.tenant.upsert({
      identifier: 'tenant-stores-other',
      name: 'Tenant Stores Other'
    });
    let otherEnvironment = await cargoClient.environment.upsert({
      tenantId: otherTenant.id,
      identifier: 'prod-other',
      name: 'Production Other',
      type: 'production'
    });

    let created = await cargoClient.storeTemplate.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      name: 'Scoped Template',
      items: [
        {
          path: '/docs/readme.md',
          type: 'document',
          content: 'scoped template',
          encoding: 'utf-8'
        }
      ]
    });

    await expect(
      cargoClient.storeTemplate.update({
        tenantId: otherTenant.id,
        environmentId: otherEnvironment.id,
        storeTemplateId: created.id,
        name: 'Wrong Scope Update'
      })
    ).rejects.toThrow('storeTemplate');

    let updated = await cargoClient.storeTemplate.update({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeTemplateId: created.id,
      name: 'Scoped Template Updated'
    });

    expect(updated.name).toBe('Scoped Template Updated');

    await expect(
      cargoClient.storeTemplate.delete({
        tenantId: otherTenant.id,
        environmentId: otherEnvironment.id,
        storeTemplateId: created.id
      })
    ).rejects.toThrow('storeTemplate');

    let deleted = await cargoClient.storeTemplate.delete({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeTemplateId: created.id
    });

    expect(deleted.id).toBe(created.id);
  });

  it('creates linked store templates and instantiates them as duplicate clones', async () => {
    let { tenant, environment } = await createScope();
    let purpose = await createPurpose();
    let actor = await createActor(tenant.id, {
      identifier: 'linked-template-creator',
      name: 'Linked Template Creator'
    });
    let sourceStore = await cargoClient.store.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: 'cst_store_template_source',
      name: 'Template Source'
    });
    let file = await createFile({
      tenantId: tenant.id,
      environmentId: environment.id,
      purposeId: purpose.id,
      id: 'cfi_store_template_file',
      storeId: 'store-template-file',
      name: 'logo.png'
    });
    let document = await cargoClient.document.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      title: 'Template Readme',
      content: 'template copy'
    });

    await cargoClient.store.modifyItems({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: sourceStore.id,
      operations: [
        {
          fileId: file.id,
          path: '/assets/logo.png'
        },
        {
          documentId: document.id,
          path: '/docs/readme.md'
        }
      ]
    });

    let template = await cargoClient.storeTemplate.create({
      name: 'Linked Template',
      storeId: sourceStore.id
    });

    let createdFromTemplate = await cargoClient.store.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: 'cst_store_from_template',
      actorId: actor.id,
      templateId: template.id,
      name: 'Created From Template'
    });

    let sourceStoreRecord = await db.store.findUnique({
      where: {
        id: sourceStore.id
      }
    });
    let templateRecord = await db.storeTemplate.findUnique({
      where: {
        id: template.id
      }
    });
    let createdStoreRecord = await db.store.findUnique({
      where: {
        id: createdFromTemplate.id
      }
    });
    let createdItems = await cargoClient.storeItem.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: createdFromTemplate.id,
      limit: 20
    });
    let createdDocumentItem = createdItems.items.find(item => item.path === '/docs/readme.md');
    let createdDocument = await cargoClient.document.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: createdDocumentItem!.documentId!
    });
    let createdDocumentRecord = await db.document.findUnique({
      where: {
        id: createdDocument.id
      }
    });
    let participant = await db.storeParticipant.findFirst({
      where: {
        store: {
          id: createdFromTemplate.id
        },
        tenantActor: {
          id: actor.id
        }
      }
    });

    expect(template).toMatchObject({
      name: 'Linked Template',
      storeId: sourceStore.id,
      sourceStoreId: sourceStore.id,
      tenantId: tenant.id,
      environmentId: environment.id,
      itemCount: 0
    });
    expect(createdFromTemplate).toMatchObject({
      id: 'cst_store_from_template',
      name: 'Created From Template',
      access: 'public_read',
      cloneType: 'duplicate'
    });
    expect(sourceStoreRecord?.access).toBe('public_read');
    expect(createdStoreRecord?.parentStoreOid).toBe(sourceStoreRecord?.oid);
    expect(createdStoreRecord?.parentStoreTemplateOid).toBe(templateRecord?.oid);
    expect(createdStoreRecord?.createdByTenantActorOid).toBeTruthy();
    expect(createdItems.items.map(item => item.path).sort()).toEqual([
      '/assets/logo.png',
      '/docs/readme.md'
    ]);
    expect(createdItems.items.find(item => item.path === '/assets/logo.png')?.fileId).toBe(file.id);
    expect(createdDocument.content).toBe('template copy');
    expect(createdDocumentRecord?.parentDocumentOid).toBeNull();
    expect(createdDocumentRecord?.isContentOwner).toBe(true);
    expect(createdDocumentRecord?.createdByTenantActorOid).toBeTruthy();
    expect(participant?.permissions).toEqual(['content_read', 'content_write']);

    let privateAccessAttempt = await cargoClient.store.update({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: createdFromTemplate.id,
      access: 'private'
    });
    let sourcePrivateAccessAttempt = await cargoClient.store.update({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: sourceStore.id,
      access: 'private'
    });

    expect(privateAccessAttempt.access).toBe('public_read');
    expect(sourcePrivateAccessAttempt.access).toBe('public_read');

    await expect(
      cargoClient.store.delete({
        tenantId: tenant.id,
        environmentId: environment.id,
        storeId: sourceStore.id
      })
    ).rejects.toThrow('Cannot delete store: it is linked to a store template');

    await expect(
      cargoClient.store.delete({
        tenantId: tenant.id,
        environmentId: environment.id,
        storeId: createdFromTemplate.id
      })
    ).rejects.toThrow('Cannot delete store: it is linked to a store template');
  });

  it('materializes standalone store templates into concrete files and documents', async () => {
    let { tenant, environment } = await createScope();
    let actor = await createActor(tenant.id, {
      identifier: 'standalone-template-creator',
      name: 'Standalone Template Creator'
    });
    let template = await cargoClient.storeTemplate.create({
      name: 'Standalone Materialized Template',
      items: [
        {
          path: '/docs/',
          type: 'directory'
        },
        {
          path: '/docs/readme.md',
          type: 'document',
          content: 'hello from template',
          encoding: 'utf-8'
        },
        {
          path: '/logo.bin',
          type: 'file',
          content: Buffer.from('binary-from-template', 'utf8').toString('base64'),
          encoding: 'base64'
        }
      ]
    });

    let createdStore = await cargoClient.store.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: 'cst_store_from_standalone_template',
      actorId: actor.id,
      templateId: template.id,
      name: 'From Standalone Template'
    });

    let createdStoreRecord = await db.store.findUnique({
      where: {
        id: createdStore.id
      }
    });
    let templateRecord = await db.storeTemplate.findUnique({
      where: {
        id: template.id
      }
    });
    let items = await cargoClient.storeItem.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: createdStore.id,
      types: ['file', 'document', 'directory'],
      limit: 20
    });
    let documentItem = items.items.find(item => item.path === '/docs/readme.md');
    let fileItem = items.items.find(item => item.path === '/logo.bin');
    let createdDocument = await cargoClient.document.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: documentItem!.documentId!
    });
    let createdFileRecord = await db.file.findUnique({
      where: {
        id: fileItem!.fileId!
      },
      include: {
        purpose: true
      }
    });
    let createdDocumentRecord = await db.document.findUnique({
      where: {
        id: createdDocument.id
      }
    });
    let participant = await db.storeParticipant.findFirst({
      where: {
        store: {
          id: createdStore.id
        },
        tenantActor: {
          id: actor.id
        }
      }
    });
    let storedFile = await getStorage().getObject(
      getCargoFilesBucketName(),
      createdFileRecord!.storeId
    );

    expect(createdStoreRecord?.parentStoreOid).toBeNull();
    expect(createdStoreRecord?.parentStoreTemplateOid).toBe(templateRecord?.oid);
    expect(createdStoreRecord?.access).toBe('public_read');
    expect(createdStoreRecord?.createdByTenantActorOid).toBeTruthy();
    expect(items.items.map(item => item.path).sort()).toEqual([
      '/',
      '/docs/',
      '/docs/readme.md',
      '/logo.bin'
    ]);
    expect(createdDocument.content).toBe('hello from template');
    expect(createdDocumentRecord?.createdByTenantActorOid).toBeTruthy();
    expect(createdFileRecord?.purpose.slug).toBe('generic');
    expect(createdFileRecord?.createdByTenantActorOid).toBeTruthy();
    expect(storedFile.data.toString('utf-8')).toBe('binary-from-template');
    expect(participant?.permissions).toEqual(['content_read', 'content_write']);
  });

  it('syncs standalone templates into hidden read-only backing stores', async () => {
    let { tenant, environment } = await createScope();
    let staging = await cargoClient.environment.upsert({
      tenantId: tenant.id,
      identifier: 'staging',
      name: 'Staging',
      type: 'development'
    });
    let otherTenant = await cargoClient.tenant.upsert({
      identifier: 'tenant-stores-template-backing-other',
      name: 'Tenant Stores Template Backing Other'
    });
    await cargoClient.environment.upsert({
      tenantId: otherTenant.id,
      identifier: 'prod',
      name: 'Production',
      type: 'production'
    });
    let initialFileContent = Buffer.from('first shared file', 'utf8').toString('base64');
    let template = await cargoClient.storeTemplate.create({
      name: 'Read Only Backing Template',
      items: [
        {
          path: '/docs/readme.md',
          type: 'document',
          content: '# Backing Template',
          encoding: 'utf-8'
        },
        {
          path: '/files/shared.txt',
          type: 'file',
          content: initialFileContent,
          encoding: 'base64'
        }
      ]
    });
    let environmentRecord = await db.environment.findUniqueOrThrow({
      where: {
        id: environment.id
      }
    });
    let stagingRecord = await db.environment.findUniqueOrThrow({
      where: {
        id: staging.id
      }
    });
    let otherTenantRecord = await db.tenant.findUniqueOrThrow({
      where: {
        id: otherTenant.id
      }
    });

    await syncStandaloneTemplate(template.id);

    let backingRows = await db.storeTemplateBacking.findMany({
      where: {
        storeTemplate: {
          id: template.id
        }
      },
      include: {
        store: true
      },
      orderBy: {
        environmentOid: 'asc'
      }
    });
    let prodBacking = backingRows.find(row => row.environmentOid === environmentRecord.oid)!;
    let backingStore = await cargoClient.store.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: prodBacking.store.id
    });
    let listedTemplates = await cargoClient.storeTemplate.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      limit: 10
    });
    let fetchedTemplate = await cargoClient.storeTemplate.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeTemplateId: template.id
    });
    let listedStores = await cargoClient.store.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      limit: 10
    });
    let backingItems = await cargoClient.storeItem.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: prodBacking.store.id,
      types: ['file', 'document', 'directory'],
      limit: 20
    });
    let documentItem = backingItems.items.find(item => item.path === '/docs/readme.md')!;
    let fileItem = backingItems.items.find(item => item.path === '/files/shared.txt')!;
    let backingDocument = await cargoClient.document.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: documentItem.documentId!
    });
    let backingFile = await cargoClient.file.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      fileId: fileItem.fileId!
    });
    let listedDocuments = await cargoClient.document.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      limit: 10
    });
    let listedFiles = await cargoClient.file.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      limit: 10
    });
    let templateFileItem = await db.storeTemplateItem.findFirstOrThrow({
      where: {
        storeTemplate: {
          id: template.id
        },
        path: '/files/shared.txt'
      }
    });
    let backingFileRows = await db.file.findMany({
      where: {
        isTemplateBacking: true,
        fileName: 'shared.txt'
      }
    });

    expect(backingRows).toHaveLength(3);
    expect(backingRows.some(row => row.environmentOid === stagingRecord.oid)).toBe(true);
    expect(backingRows.some(row => row.tenantOid === otherTenantRecord.oid)).toBe(true);
    expect(backingRows.map(row => row.store.access)).toEqual([
      'public_read',
      'public_read',
      'public_read'
    ]);
    expect(backingRows.map(row => row.store.isReadOnly)).toEqual([true, true, true]);
    expect(backingRows.map(row => row.store.isTemplateBacking)).toEqual([true, true, true]);
    expect(backingStore).toMatchObject({
      access: 'public_read',
      isReadOnly: true,
      isTemplateBacking: true
    });
    expect(listedTemplates.items.find(item => item.id === template.id)?.storeId).toBe(
      prodBacking.store.id
    );
    expect(fetchedTemplate.storeId).toBe(prodBacking.store.id);
    expect(listedStores.items).toHaveLength(0);
    expect(backingItems.items.map(item => item.path).sort()).toEqual([
      '/',
      '/docs/',
      '/docs/readme.md',
      '/files/',
      '/files/shared.txt'
    ]);
    expect(backingDocument).toMatchObject({
      content: '# Backing Template',
      isReadOnly: true,
      isTemplateBacking: true
    });
    expect(backingFile).toMatchObject({
      isReadOnly: true,
      isTemplateBacking: true
    });
    expect(listedDocuments.items).toHaveLength(0);
    expect(listedFiles.items).toHaveLength(0);
    expect(new Set(backingFileRows.map(file => file.storeId))).toEqual(
      new Set([templateFileItem.fileStoreId])
    );

    await expect(
      cargoClient.store.modifyItems({
        tenantId: tenant.id,
        environmentId: environment.id,
        storeId: prodBacking.store.id,
        operations: [
          {
            path: '/blocked/'
          }
        ]
      })
    ).rejects.toThrow('read-only');
    await expect(
      cargoClient.document.update({
        tenantId: tenant.id,
        environmentId: environment.id,
        documentId: backingDocument.id,
        content: 'blocked'
      })
    ).rejects.toThrow('read-only');
    await expect(
      cargoClient.file.update({
        tenantId: tenant.id,
        environmentId: environment.id,
        fileId: backingFile.id,
        title: 'blocked'
      })
    ).rejects.toThrow('read-only');

    await storeTemplateService.updateStoreTemplate({
      skipScopeCheck: true,
      storeTemplate: await storeTemplateService.getStoreTemplateByIdUnsafe({
        storeTemplateId: template.id
      }),
      input: {
        name: 'Read Only Backing Template',
        items: [
          {
            path: '/docs/readme.md',
            type: 'document',
            content: '# Updated Backing Template',
            encoding: 'utf-8'
          },
          {
            path: '/files/next.txt',
            type: 'file',
            content: Buffer.from('next shared file', 'utf8').toString('base64'),
            encoding: 'base64'
          }
        ]
      }
    });
    await syncStandaloneTemplate(template.id);

    let updatedItems = await cargoClient.storeItem.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: prodBacking.store.id,
      types: ['file', 'document', 'directory'],
      limit: 20
    });
    let updatedDocumentItem = updatedItems.items.find(item => item.path === '/docs/readme.md')!;
    let updatedDocument = await cargoClient.document.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: updatedDocumentItem.documentId!
    });

    expect(updatedItems.items.map(item => item.path).sort()).toEqual([
      '/',
      '/docs/',
      '/docs/readme.md',
      '/files/',
      '/files/next.txt'
    ]);
    expect(updatedDocument.content).toBe('# Updated Backing Template');

    let futureEnvironment = await cargoClient.environment.upsert({
      tenantId: tenant.id,
      identifier: 'future',
      name: 'Future',
      type: 'development'
    });
    await storeTemplateSyncService.syncStoreTemplateBackingStore({
      storeTemplateId: template.id,
      tenantId: tenant.id,
      environmentId: futureEnvironment.id,
      forceFullReconcile: true
    });
    let futureBacking = await db.storeTemplateBacking.findFirst({
      where: {
        storeTemplate: {
          id: template.id
        },
        environment: {
          id: futureEnvironment.id
        }
      }
    });

    expect(futureBacking).toBeTruthy();
  });

  it('rejects invalid store-template create targets and template-parent conflicts', async () => {
    let { tenant, environment } = await createScope();
    let secondEnvironment = await cargoClient.environment.upsert({
      tenantId: tenant.id,
      identifier: 'staging',
      name: 'Staging',
      type: 'development'
    });
    let otherTenant = await cargoClient.tenant.upsert({
      identifier: 'tenant-store-template-other',
      name: 'Tenant Store Template Other'
    });
    let otherEnvironment = await cargoClient.environment.upsert({
      tenantId: otherTenant.id,
      identifier: 'prod',
      name: 'Production',
      type: 'production'
    });
    let sourceStore = await cargoClient.store.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: 'cst_store_template_scope_source',
      name: 'Scoped Source'
    });
    let linkedTemplate = await cargoClient.storeTemplate.create({
      name: 'Scoped Linked Template',
      storeId: sourceStore.id
    });
    let standaloneScopedTemplate = await cargoClient.storeTemplate.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      name: 'Scoped Standalone Template',
      items: [
        {
          path: '/readme.md',
          type: 'document',
          content: 'scoped',
          encoding: 'utf-8'
        }
      ]
    });

    await expect(
      cargoClient.store.create({
        tenantId: tenant.id,
        environmentId: secondEnvironment.id,
        templateId: linkedTemplate.id,
        name: 'Wrong Environment Clone'
      })
    ).rejects.toThrow('linked environment');

    await expect(
      cargoClient.store.create({
        tenantId: otherTenant.id,
        environmentId: otherEnvironment.id,
        templateId: standaloneScopedTemplate.id,
        name: 'Wrong Tenant Clone'
      })
    ).rejects.toThrow('linked tenant');

    await expect(
      cargoClient.store.create({
        tenantId: tenant.id,
        environmentId: environment.id,
        templateId: linkedTemplate.id,
        parentId: sourceStore.id,
        name: 'Conflicting Clone Inputs'
      })
    ).rejects.toThrow('mutually exclusive');
  });
});
