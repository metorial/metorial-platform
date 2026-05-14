import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../db';
import { cargoClient } from '../../test/client';
import { cleanDatabase } from '../../test/setup';

let createActor = async (d: {
  tenantId: string;
  identifier: string;
  name: string;
}) =>
  await cargoClient.actor.upsert({
    tenantId: d.tenantId,
    identifier: d.identifier,
    name: d.name
  });

describe('cargo file.e2e', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it('detects references beyond the first 100 file links', async () => {
    let tenant = await cargoClient.tenant.upsert({
      identifier: 'tenant-file-reference-limit',
      name: 'Tenant File Reference Limit'
    });

    let environment = await cargoClient.environment.upsert({
      tenantId: tenant.id,
      identifier: 'prod',
      name: 'Production',
      type: 'production'
    });

    let purpose = await cargoClient.filePurpose.upsert({
      slug: 'organization_image',
      name: 'Organization Image',
      ownerType: 'organization',
      canHaveLinks: true
    });

    let file = await cargoClient.file.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      purpose: purpose.id,
      storeId: 'store-file-many-links',
      name: 'avatar.png',
      mimeType: 'image/png',
      size: 128,
      title: 'Avatar'
    });

    let links = await Promise.all(
      Array.from({ length: 101 }, async (_, index) =>
        cargoClient.fileLink.create({
          tenantId: tenant.id,
          environmentId: environment.id,
          fileId: file.id,
          key: `link-${index + 1}`
        })
      )
    );

    await cargoClient.fileReference.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      fileLinkId: links[100]!.id,
      entityType: 'organization',
      entityId: 'org_101'
    });

    let result = await cargoClient.fileReference.hasReferencesForFile({
      tenantId: tenant.id,
      environmentId: environment.id,
      fileId: file.id
    });

    expect(result.hasReferences).toBe(true);
  });

  it('creates, links, protects, and deletes files within one tenant environment', async () => {
    let tenant = await cargoClient.tenant.upsert({
      identifier: 'tenant-files',
      name: 'Tenant Files'
    });

    let environment = await cargoClient.environment.upsert({
      tenantId: tenant.id,
      identifier: 'prod',
      name: 'Production',
      type: 'production'
    });

    let purpose = await cargoClient.filePurpose.upsert({
      slug: 'organization_image',
      name: 'Organization Image',
      ownerType: 'organization',
      canHaveLinks: true
    });

    let file = await cargoClient.file.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      purpose: purpose.id,
      storeId: 'store-file-1',
      name: 'avatar.png',
      mimeType: 'image/png',
      size: 128,
      title: 'Avatar'
    });

    let link = await cargoClient.fileLink.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      fileId: file.id
    });

    let reference = await cargoClient.fileReference.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      fileLinkId: link.id,
      entityType: 'organization',
      entityId: 'org_123'
    });

    let linkHasReferences = await cargoClient.fileReference.hasReferences({
      tenantId: tenant.id,
      environmentId: environment.id,
      fileLinkId: link.id
    });

    expect(linkHasReferences.hasReferences).toBe(true);

    let listed = await cargoClient.file.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      limit: 10
    });

    expect(listed.items).toHaveLength(1);
    expect(listed.items[0]).toMatchObject({
      id: file.id,
      type: 'file',
      documentId: undefined,
      title: 'Avatar'
    });

    await expect(
      cargoClient.file.delete({
        tenantId: tenant.id,
        environmentId: environment.id,
        fileId: file.id
      })
    ).rejects.toThrow('Cannot delete file: it has active references');

    await cargoClient.fileReference.delete({
      tenantId: tenant.id,
      environmentId: environment.id,
      fileReferenceId: reference.id
    });

    await cargoClient.fileLink.delete({
      tenantId: tenant.id,
      environmentId: environment.id,
      fileLinkId: link.id
    });

    let deleted = await cargoClient.file.delete({
      tenantId: tenant.id,
      environmentId: environment.id,
      fileId: file.id
    });

    expect(deleted.status).toBe('deleted');
    expect(deleted.type).toBe('file');
    expect(deleted.documentId).toBeUndefined();
  });

  it('filters files and file links with array params', async () => {
    let tenant = await cargoClient.tenant.upsert({
      identifier: 'tenant-file-array-filters',
      name: 'Tenant File Array Filters'
    });

    let environment = await cargoClient.environment.upsert({
      tenantId: tenant.id,
      identifier: 'prod',
      name: 'Production',
      type: 'production'
    });

    let firstPurpose = await cargoClient.filePurpose.upsert({
      slug: 'organization_image_array',
      name: 'Organization Image Array',
      ownerType: 'organization',
      canHaveLinks: true
    });

    let secondPurpose = await cargoClient.filePurpose.upsert({
      slug: 'organization_avatar_array',
      name: 'Organization Avatar Array',
      ownerType: 'organization',
      canHaveLinks: true
    });

    let firstFile = await cargoClient.file.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      purpose: firstPurpose.id,
      storeId: 'store-file-array-1',
      name: 'first.png',
      mimeType: 'image/png',
      size: 128,
      title: 'First'
    });

    let secondFile = await cargoClient.file.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      purpose: secondPurpose.id,
      storeId: 'store-file-array-2',
      name: 'second.png',
      mimeType: 'image/png',
      size: 256,
      title: 'Second'
    });

    let firstLink = await cargoClient.fileLink.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      fileId: firstFile.id
    });

    let secondLink = await cargoClient.fileLink.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      fileId: secondFile.id
    });

    let files = await cargoClient.file.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      purpose: [firstPurpose.id, secondPurpose.id],
      limit: 10
    });

    expect(files.items.map(file => file.id).sort()).toEqual([firstFile.id, secondFile.id].sort());

    let fileLinks = await cargoClient.fileLink.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      fileIds: [firstFile.id, secondFile.id],
      limit: 10
    });

    expect(fileLinks.items.map(link => link.id).sort()).toEqual([firstLink.id, secondLink.id].sort());
  });

  it('rejects document-purpose files from the normal file API', async () => {
    let tenant = await cargoClient.tenant.upsert({
      identifier: 'tenant-document-purpose',
      name: 'Tenant Document Purpose'
    });

    let environment = await cargoClient.environment.upsert({
      tenantId: tenant.id,
      identifier: 'prod',
      name: 'Production',
      type: 'production'
    });

    await cargoClient.filePurpose.upsert({
      slug: 'document',
      name: 'Document',
      ownerType: 'organization',
      canHaveLinks: true
    });

    await expect(
      cargoClient.file.create({
        tenantId: tenant.id,
        environmentId: environment.id,
        purpose: 'document',
        storeId: 'store-file-document',
        name: 'document.md',
        mimeType: 'text/markdown',
        size: 64,
        title: 'Document'
      })
    ).rejects.toThrow('Document purpose cannot be used for normal file creation');
  });

  it('archives linked documents when deleting a document-backed file', async () => {
    let tenant = await cargoClient.tenant.upsert({
      identifier: 'tenant-file-document-delete',
      name: 'Tenant File Document Delete'
    });

    let environment = await cargoClient.environment.upsert({
      tenantId: tenant.id,
      identifier: 'prod',
      name: 'Production',
      type: 'production'
    });

    let document = await cargoClient.document.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      title: 'Document',
      content: 'body'
    });

    let deletedFile = await cargoClient.file.delete({
      tenantId: tenant.id,
      environmentId: environment.id,
      fileId: document.fileId
    });

    expect(deletedFile).toMatchObject({
      id: document.fileId,
      type: 'document',
      documentId: document.id,
      status: 'deleted'
    });

    let listedDocuments = await cargoClient.document.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      limit: 10
    });

    expect(listedDocuments.items).toHaveLength(0);

    await expect(
      cargoClient.document.get({
        tenantId: tenant.id,
        environmentId: environment.id,
        documentId: document.id
      })
    ).rejects.toThrow();
  });

  it('uses the parent store for linked document files until the first divergent write', async () => {
    let tenant = await cargoClient.tenant.upsert({
      identifier: 'tenant-file-linked-document-store',
      name: 'Tenant File Linked Document Store'
    });

    let environment = await cargoClient.environment.upsert({
      tenantId: tenant.id,
      identifier: 'prod',
      name: 'Production',
      type: 'production'
    });

    let parent = await cargoClient.document.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      title: 'Parent',
      content: 'shared'
    });

    let child = await cargoClient.document.clone({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: parent.id,
      title: 'Child'
    });
    let childFileRecord = await db.file.findUnique({
      where: {
        id: child.fileId
      }
    });

    let childFileBeforeFork = await cargoClient.file.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      fileId: child.fileId
    });
    let listedBeforeFork = await cargoClient.file.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      limit: 10
    });

    await cargoClient.document.update({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: child.id,
      content: 'child-owned'
    });

    let childFileAfterFork = await cargoClient.file.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      fileId: child.fileId
    });
    let listedAfterFork = await cargoClient.file.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      limit: 10
    });
    let listedChildBeforeFork = listedBeforeFork.items.find(item => item.id === child.fileId);
    let listedChildAfterFork = listedAfterFork.items.find(item => item.id === child.fileId);

    expect(childFileBeforeFork.storeId).toBe(parent.file.storeId);
    expect(listedChildBeforeFork?.storeId).toBe(parent.file.storeId);
    expect(childFileAfterFork.storeId).toBe(childFileRecord?.storeId);
    expect(listedChildAfterFork?.storeId).toBe(childFileRecord?.storeId);
  });

  it('attaches files to stores on create when write access is available', async () => {
    let tenant = await cargoClient.tenant.upsert({
      identifier: 'tenant-file-store-shortcut',
      name: 'Tenant File Store Shortcut'
    });

    let environment = await cargoClient.environment.upsert({
      tenantId: tenant.id,
      identifier: 'prod',
      name: 'Production',
      type: 'production'
    });

    let actor = await cargoClient.actor.upsert({
      tenantId: tenant.id,
      identifier: 'file-store-actor',
      name: 'File Store Actor'
    });

    let purpose = await cargoClient.filePurpose.upsert({
      slug: 'organization_image_store_shortcut',
      name: 'Organization Image Store Shortcut',
      ownerType: 'organization',
      canHaveLinks: true
    });

    let store = await cargoClient.store.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      name: 'Shortcut Store'
    });

    let file = await cargoClient.file.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      purpose: purpose.id,
      storeId: 'shortcut-file',
      name: 'shortcut.png',
      mimeType: 'image/png',
      size: 128,
      title: 'Shortcut',
      actorId: actor.id,
      defaultPermissions: ['content_write'],
      overridePermissions: true,
      store: {
        id: store.id,
        path: '/shortcut.png'
      }
    });

    let items = await cargoClient.storeItem.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      storeId: store.id,
      limit: 10
    });

    expect(items.items).toHaveLength(1);
    expect(items.items[0]).toMatchObject({
      fileId: file.id,
      path: '/shortcut.png'
    });

    await expect(
      cargoClient.file.create({
        tenantId: tenant.id,
        environmentId: environment.id,
        purpose: purpose.id,
        storeId: 'shortcut-file-denied',
        name: 'denied.png',
        mimeType: 'image/png',
        size: 128,
        title: 'Denied',
        actorId: actor.id,
        defaultPermissions: ['content_read'],
        overridePermissions: true,
        store: {
          id: store.id,
          path: '/denied.png'
        }
      })
    ).rejects.toThrow('Missing content_write access');

    let deniedFile = await db.file.findFirst({
      where: {
        storeId: 'shortcut-file-denied'
      }
    });

    expect(deniedFile).toBeNull();
  });

  it('restricts file reads to creators or accessible store participants when actorId is set', async () => {
    let tenant = await cargoClient.tenant.upsert({
      identifier: 'tenant-file-access',
      name: 'Tenant File Access'
    });

    let environment = await cargoClient.environment.upsert({
      tenantId: tenant.id,
      identifier: 'prod',
      name: 'Production',
      type: 'production'
    });

    let creator = await createActor({
      tenantId: tenant.id,
      identifier: 'file-creator',
      name: 'File Creator'
    });
    let reader = await createActor({
      tenantId: tenant.id,
      identifier: 'file-reader',
      name: 'File Reader'
    });
    let denied = await createActor({
      tenantId: tenant.id,
      identifier: 'file-denied',
      name: 'File Denied'
    });

    let purpose = await cargoClient.filePurpose.upsert({
      slug: 'organization_image_file_access',
      name: 'Organization Image File Access',
      ownerType: 'organization',
      canHaveLinks: true
    });

    let ownFile = await cargoClient.file.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      purpose: purpose.id,
      storeId: 'file-access-own',
      name: 'own.png',
      mimeType: 'image/png',
      size: 64,
      title: 'Own',
      actorId: creator.id
    });

    let ownFileRecord = await db.file.findFirst({
      where: {
        id: ownFile.id
      }
    });

    expect(ownFileRecord?.createdByTenantActorOid).toBeTruthy();

    let store = await cargoClient.store.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      name: 'File Access Store'
    });

    let storeFile = await cargoClient.file.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      purpose: purpose.id,
      storeId: 'file-access-store',
      name: 'store.png',
      mimeType: 'image/png',
      size: 96,
      title: 'Store',
      store: {
        id: store.id,
        path: '/store.png'
      }
    });

    let creatorRead = await cargoClient.file.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      fileId: ownFile.id,
      actorId: creator.id
    });

    expect(creatorRead.id).toBe(ownFile.id);

    let creatorList = await cargoClient.file.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      actorId: creator.id,
      limit: 10
    });

    expect(creatorList.items.map(file => file.id)).toContain(ownFile.id);

    await expect(
      cargoClient.file.get({
        tenantId: tenant.id,
        environmentId: environment.id,
        fileId: ownFile.id,
        actorId: denied.id
      })
    ).rejects.toThrow('Missing content_read access for file');

    let readerStoreFile = await cargoClient.file.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      fileId: storeFile.id,
      actorId: reader.id,
      defaultPermissions: ['content_read'],
      overridePermissions: true
    });

    expect(readerStoreFile.id).toBe(storeFile.id);

    let readerList = await cargoClient.file.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      actorId: reader.id,
      defaultPermissions: ['content_read'],
      overridePermissions: true,
      limit: 10
    });

    expect(readerList.items.map(file => file.id)).toContain(storeFile.id);
    expect(readerList.items.map(file => file.id)).not.toContain(ownFile.id);

    await expect(
      cargoClient.file.get({
        tenantId: tenant.id,
        environmentId: environment.id,
        fileId: storeFile.id,
        actorId: denied.id
      })
    ).rejects.toThrow('Missing content_read access for file');

    let deniedList = await cargoClient.file.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      actorId: denied.id,
      limit: 10
    });

    expect(deniedList.items).toHaveLength(0);
  });

  it('allows file deletion only for the creating actor when actorId is set', async () => {
    let tenant = await cargoClient.tenant.upsert({
      identifier: 'tenant-file-delete-access',
      name: 'Tenant File Delete Access'
    });

    let environment = await cargoClient.environment.upsert({
      tenantId: tenant.id,
      identifier: 'prod',
      name: 'Production',
      type: 'production'
    });

    let creator = await createActor({
      tenantId: tenant.id,
      identifier: 'file-delete-creator',
      name: 'File Delete Creator'
    });
    let otherActor = await createActor({
      tenantId: tenant.id,
      identifier: 'file-delete-other',
      name: 'File Delete Other'
    });

    let purpose = await cargoClient.filePurpose.upsert({
      slug: 'organization_image_file_delete_access',
      name: 'Organization Image File Delete Access',
      ownerType: 'organization',
      canHaveLinks: true
    });

    let creatorFile = await cargoClient.file.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      purpose: purpose.id,
      storeId: 'file-delete-own',
      name: 'own-delete.png',
      mimeType: 'image/png',
      size: 64,
      title: 'Own Delete',
      actorId: creator.id
    });

    await expect(
      cargoClient.file.delete({
        tenantId: tenant.id,
        environmentId: environment.id,
        fileId: creatorFile.id,
        actorId: otherActor.id
      })
    ).rejects.toThrow(`Only the creating actor can delete file ${creatorFile.id}`);

    let deniedRecord = await db.file.findFirst({
      where: {
        id: creatorFile.id
      }
    });

    expect(deniedRecord?.status).toBe('active');

    await cargoClient.file.delete({
      tenantId: tenant.id,
      environmentId: environment.id,
      fileId: creatorFile.id,
      actorId: creator.id
    });

    let deletedRecord = await db.file.findFirst({
      where: {
        id: creatorFile.id
      }
    });

    expect(deletedRecord?.status).toBe('deleted');
  });

  it('restricts file link reads to the creating actor when actorId is set', async () => {
    let tenant = await cargoClient.tenant.upsert({
      identifier: 'tenant-file-link-access',
      name: 'Tenant File Link Access'
    });

    let environment = await cargoClient.environment.upsert({
      tenantId: tenant.id,
      identifier: 'prod',
      name: 'Production',
      type: 'production'
    });

    let creator = await createActor({
      tenantId: tenant.id,
      identifier: 'file-link-creator',
      name: 'File Link Creator'
    });
    let otherActor = await createActor({
      tenantId: tenant.id,
      identifier: 'file-link-other',
      name: 'File Link Other'
    });

    let purpose = await cargoClient.filePurpose.upsert({
      slug: 'organization_image_file_link_access',
      name: 'Organization Image File Link Access',
      ownerType: 'organization',
      canHaveLinks: true
    });

    let file = await cargoClient.file.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      purpose: purpose.id,
      storeId: 'file-link-access-file',
      name: 'link.png',
      mimeType: 'image/png',
      size: 64,
      title: 'Linkable'
    });

    let fileLink = await cargoClient.fileLink.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      fileId: file.id,
      actorId: creator.id
    });

    let fileLinkRecord = await db.fileLink.findFirst({
      where: {
        id: fileLink.id
      }
    });

    expect(fileLinkRecord?.createdByTenantActorOid).toBeTruthy();

    let creatorGet = await cargoClient.fileLink.get({
      tenantId: tenant.id,
      environmentId: environment.id,
      fileLinkId: fileLink.id,
      actorId: creator.id
    });

    expect(creatorGet.id).toBe(fileLink.id);

    let creatorList = await cargoClient.fileLink.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      actorId: creator.id,
      limit: 10
    });

    expect(creatorList.items.map(link => link.id)).toEqual([fileLink.id]);

    await expect(
      cargoClient.fileLink.get({
        tenantId: tenant.id,
        environmentId: environment.id,
        fileLinkId: fileLink.id,
        actorId: otherActor.id
      })
    ).rejects.toThrow();

    let otherList = await cargoClient.fileLink.list({
      tenantId: tenant.id,
      environmentId: environment.id,
      actorId: otherActor.id,
      limit: 10
    });

    expect(otherList.items).toHaveLength(0);
  });
});
