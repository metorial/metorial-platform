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
      name: 'Brand Assets'
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
      itemCount: 0
    });
    expect(listed.items).toHaveLength(1);
    expect(fetched.id).toBe(created.id);
    expect(fetched.itemCount).toBe(0);
    expect(updated.name).toBe('Brand Assets');
    expect(deleted.id).toBe(created.id);
    expect(listedAfterDelete.items).toHaveLength(0);
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
});
