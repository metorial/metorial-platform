import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../db';
import { cargoClient } from '../../test/client';
import { cleanDatabase } from '../../test/setup';

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
      fileId: [firstFile.id, secondFile.id],
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
});
