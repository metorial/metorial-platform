import { beforeEach, describe, expect, it } from 'vitest';
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
});
