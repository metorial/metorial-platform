import {
  cleanupDeletedFileStorage,
  getCargoFilesBucketName,
  getStorage,
  listDeletedFilesWithStorage
} from '@metorial-cargo/module-file';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../db';
import { cargoClient } from '../../test/client';
import { cleanDatabase } from '../../test/setup';

let createEnvironment = async () => {
  let tenant = await cargoClient.tenant.upsert({
    identifier: 'tenant-file-cleanup',
    name: 'Tenant File Cleanup'
  });

  let environment = await cargoClient.environment.upsert({
    tenantId: tenant.id,
    identifier: 'prod',
    name: 'Production',
    type: 'production'
  });

  let purpose = await cargoClient.filePurpose.upsert({
    slug: 'organization_image_file_cleanup',
    name: 'Organization Image File Cleanup',
    ownerType: 'organization',
    canHaveLinks: true
  });

  return { tenant, environment, purpose };
};

describe('cargo file cleanup.e2e', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it('lists deleted files that still have storage keys', async () => {
    let { tenant, environment, purpose } = await createEnvironment();

    await cargoClient.file.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      purpose: purpose.id,
      storeId: 'cleanup-active',
      name: 'active.png',
      mimeType: 'image/png',
      size: 128
    });

    let deletedFile = await cargoClient.file.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      purpose: purpose.id,
      storeId: 'cleanup-deleted',
      name: 'deleted.png',
      mimeType: 'image/png',
      size: 128
    });
    await cargoClient.file.delete({
      tenantId: tenant.id,
      environmentId: environment.id,
      fileId: deletedFile.id
    });

    let deletedWithoutStorage = await cargoClient.file.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      purpose: purpose.id,
      storeId: '',
      name: 'deleted-without-storage.png',
      mimeType: 'image/png',
      size: 128
    });
    await cargoClient.file.delete({
      tenantId: tenant.id,
      environmentId: environment.id,
      fileId: deletedWithoutStorage.id
    });

    let files = await listDeletedFilesWithStorage({ limit: 10 });

    expect(files.map(file => file.id)).toEqual([deletedFile.id]);
  });

  it('deletes object storage content for a single deleted file', async () => {
    let { tenant, environment, purpose } = await createEnvironment();
    await getStorage().putObject(
      getCargoFilesBucketName(),
      'cleanup-single',
      Buffer.from('cleanup-single')
    );

    let file = await cargoClient.file.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      purpose: purpose.id,
      storeId: 'cleanup-single',
      name: 'single.png',
      mimeType: 'image/png',
      size: 128
    });
    await cargoClient.file.delete({
      tenantId: tenant.id,
      environmentId: environment.id,
      fileId: file.id
    });

    await expect(
      cleanupDeletedFileStorage({
        fileId: file.id
      })
    ).resolves.toBe(true);

    await expect(
      getStorage().getObject(getCargoFilesBucketName(), 'cleanup-single')
    ).rejects.toThrow();

    let cleanedFile = await db.file.findUnique({
      where: {
        id: file.id
      }
    });
    expect(cleanedFile?.storeId).toBe('cleanup-single');
  });

  it('keeps object storage when an active file shares the deleted file store id', async () => {
    let { tenant, environment, purpose } = await createEnvironment();
    await getStorage().putObject(
      getCargoFilesBucketName(),
      'cleanup-shared',
      Buffer.from('cleanup-shared')
    );

    let deletedFile = await cargoClient.file.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      purpose: purpose.id,
      storeId: 'cleanup-shared',
      name: 'shared-deleted.png',
      mimeType: 'image/png',
      size: 128
    });
    await cargoClient.file.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      purpose: purpose.id,
      storeId: 'cleanup-shared',
      name: 'shared-active.png',
      mimeType: 'image/png',
      size: 128
    });
    await cargoClient.file.delete({
      tenantId: tenant.id,
      environmentId: environment.id,
      fileId: deletedFile.id
    });

    await expect(
      cleanupDeletedFileStorage({
        fileId: deletedFile.id
      })
    ).resolves.toBe(false);

    await expect(
      getStorage().getObject(getCargoFilesBucketName(), 'cleanup-shared')
    ).resolves.toMatchObject({
      data: Buffer.from('cleanup-shared')
    });
  });

  it('skips missing files, active files, and deleted files without storage keys', async () => {
    let { tenant, environment, purpose } = await createEnvironment();

    let activeFile = await cargoClient.file.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      purpose: purpose.id,
      storeId: 'cleanup-active-skip',
      name: 'active-skip.png',
      mimeType: 'image/png',
      size: 128
    });

    let deletedWithoutStorage = await cargoClient.file.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      purpose: purpose.id,
      storeId: '',
      name: 'deleted-without-storage-skip.png',
      mimeType: 'image/png',
      size: 128
    });
    await cargoClient.file.delete({
      tenantId: tenant.id,
      environmentId: environment.id,
      fileId: deletedWithoutStorage.id
    });

    await expect(
      cleanupDeletedFileStorage({
        fileId: activeFile.id
      })
    ).resolves.toBe(false);
    await expect(
      cleanupDeletedFileStorage({
        fileId: deletedWithoutStorage.id
      })
    ).resolves.toBe(false);
    await expect(
      cleanupDeletedFileStorage({
        fileId: 'missing-file'
      })
    ).resolves.toBe(false);

  });
});
