import { createFetchRouter } from '@lowerdeck/testing-tools';
import { cargoContentApi, cargoUploadApi } from '@metorial-cargo/module-file/http';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  downloadFile,
  getFileDownloadUrl,
  uploadFile
} from '../../../../clients/cargo/src/index';
import { cargoClient } from '../../test/client';
import { cleanDatabase } from '../../test/setup';

describe('cargo http.e2e', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it('uploads via fetch helper and downloads through the content endpoint', async () => {
    let tenant = await cargoClient.tenant.upsert({
      identifier: 'tenant-http',
      name: 'Tenant Http'
    });

    let environment = await cargoClient.environment.upsert({
      tenantId: tenant.id,
      identifier: 'dev',
      name: 'Development',
      type: 'development'
    });

    let purpose = await cargoClient.filePurpose.upsert({
      slug: 'organization_image',
      name: 'Organization Image',
      ownerType: 'organization',
      canHaveLinks: true
    });

    let fetchRouter = createFetchRouter();
    fetchRouter.registerRoute('http://cargo-upload.test/files', request =>
      cargoUploadApi.fetch(request)
    );
    fetchRouter.install();

    let uploaded = await uploadFile(
      {
        uploadEndpoint: 'http://cargo-upload.test',
        contentEndpoint: 'http://cargo-content.test'
      },
      {
        tenantId: tenant.id,
        environmentId: environment.id,
        purpose: purpose.id,
        file: new Blob([Buffer.from('hello-cargo')], {
          type: 'image/png'
        }),
        fileName: 'avatar.png',
        storeId: 'http-store-id'
      }
    );

    let link = await cargoClient.fileLink.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      fileId: uploaded.id
    });

    fetchRouter.registerRoute(
      getFileDownloadUrl({
        contentEndpoint: 'http://cargo-content.test',
        fileId: uploaded.id,
        key: link.key
      }),
      request => cargoContentApi.fetch(request)
    );

    let response = await downloadFile({
      contentEndpoint: 'http://cargo-content.test',
      fileId: uploaded.id,
      key: link.key
    });

    expect(uploaded).toMatchObject({
      id: expect.any(String),
      fileName: 'avatar.png',
      purpose: {
        id: purpose.id
      }
    });

    expect(await response.text()).toBe('hello-cargo');
    expect(response.headers.get('Content-Type')).toBe('image/png');

    fetchRouter.registerRoute(
      getFileDownloadUrl({
        contentEndpoint: 'http://cargo-content.test',
        fileId: uploaded.id,
        key: link.key,
        download: true
      }),
      request => cargoContentApi.fetch(request)
    );

    let downloadResponse = await downloadFile({
      contentEndpoint: 'http://cargo-content.test',
      fileId: uploaded.id,
      key: link.key,
      download: true
    });

    expect(await downloadResponse.text()).toBe('hello-cargo');
    expect(downloadResponse.headers.get('Content-Disposition')).toBe(
      `attachment; filename="avatar.png"; filename*=UTF-8''avatar.png`
    );
  });

  it('serves live document content without object storage for document-backed files', async () => {
    let tenant = await cargoClient.tenant.upsert({
      identifier: 'tenant-http-document',
      name: 'Tenant Http Document'
    });

    let environment = await cargoClient.environment.upsert({
      tenantId: tenant.id,
      identifier: 'dev',
      name: 'Development',
      type: 'development'
    });

    let document = await cargoClient.document.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      title: 'Document',
      content: 'live-document-content'
    });

    await cargoClient.document.update({
      tenantId: tenant.id,
      environmentId: environment.id,
      documentId: document.id,
      content: 'redis-draft-content'
    });

    let link = await cargoClient.fileLink.create({
      tenantId: tenant.id,
      environmentId: environment.id,
      fileId: document.fileId
    });

    let fetchRouter = createFetchRouter();
    fetchRouter.registerRoute(
      getFileDownloadUrl({
        contentEndpoint: 'http://cargo-content.test',
        fileId: document.fileId,
        key: link.key
      }),
      request => cargoContentApi.fetch(request)
    );
    fetchRouter.install();

    let response = await downloadFile({
      contentEndpoint: 'http://cargo-content.test',
      fileId: document.fileId,
      key: link.key
    });

    expect(await response.text()).toBe('redis-draft-content');
    expect(response.headers.get('Content-Type')).toBe('text/markdown');
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  });
});
