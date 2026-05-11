import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../db';
import { storeService } from '../../services';
import { cargoClient } from '../../test/client';
import { cleanDatabase } from '../../test/setup';

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
      itemCount: 0
    });
    expect(listed.items).toHaveLength(1);
    expect(fetched.id).toBe(created.id);
    expect(fetched.itemCount).toBe(0);
    expect(fetched.access).toBe('private');
    expect(updated.name).toBe('Brand Assets');
    expect(updated.access).toBe('public_read');
    expect(deleted.id).toBe(created.id);
    expect(listedAfterDelete.items).toHaveLength(0);
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
      name: 'Cloned Store'
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
      itemCount: 2
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
    expect(clonedDocumentRecord?.parentDocumentOid).toBe(sourceDocumentRecord?.oid);
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
    expect(storeAfterAdds.itemCount).toBe(2);

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
    expect(storeAfterOverwrite.itemCount).toBe(2);

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
    expect(storeAfterRemove.itemCount).toBe(1);

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
});
