import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  env: {
    storage: {
      MAX_ATTACHMENT_SIZE_BYTES: 200 * 1024 * 1024,
      SLATES_LIVE_UPLOAD_MODE: 'multipart' as 'single' | 'multipart',
      SLATES_LIVE_UPLOAD_BASE_URL: 'http://object-upload.platform.metorial.internal' as
        string | undefined
    }
  },
  db: {
    slateInvocation: { findFirst: vi.fn() },
    slateAttachmentUpload: {
      create: vi.fn(),
      findFirst: vi.fn(),
      updateMany: vi.fn()
    }
  },
  storage: {
    getPublicURL: vi.fn(),
    startMultipartUpload: vi.fn(),
    getPartManifests: vi.fn(),
    completePublicMultipartUpload: vi.fn(),
    abortMultipartUpload: vi.fn()
  },
  deleteQueue: { add: vi.fn() }
}));

vi.mock('../../env', () => ({ env: mocks.env }));
vi.mock('../../db', () => ({ db: mocks.db }));
vi.mock('../../storage', () => ({
  invocationsBucketRecord: { bucket: 'invocations' },
  storage: mocks.storage
}));
vi.mock('../../queues/attachment/uploadDelete', () => ({
  slateAttachmentUploadDeleteQueue: mocks.deleteQueue
}));
vi.mock('../../lib/invocation/liveToken', () => ({
  resolveLiveInvocationToken: vi.fn(async (token: string) =>
    token === 'live-token' ? { invocationId: 'slateInvocation_1', tenantOid: 1n } : null
  ),
  reserveAttachmentBudget: vi.fn(async () => ({ newCount: 1, newSize: 1 })),
  releaseAttachmentBudget: vi.fn()
}));

let { liveInvocationApp, liveInvocationOnlyApp } = await import('./liveInvocation');

let MiB = 1024 * 1024;

let post = (path: string, body: unknown) =>
  liveInvocationApp.request(`/slates-hub/live-invocation${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer live-token' },
    body: JSON.stringify(body)
  });

let multipartUpload = (overrides: Record<string, unknown> = {}) => ({
  oid: 7n,
  id: 'shau_1',
  status: 'pending',
  storageBucket: 'invocations',
  storageKey: 'attachments/uploads/shau_1',
  declaredSizeBytes: 40 * MiB,
  partSizeBytes: 16 * MiB,
  multipartUploadId: 'upload_1',
  expiresAt: new Date(Date.now() + 60_000),
  ...overrides
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.env.storage.SLATES_LIVE_UPLOAD_MODE = 'multipart';
  mocks.env.storage.SLATES_LIVE_UPLOAD_BASE_URL =
    'http://object-upload.platform.metorial.internal';

  mocks.db.slateInvocation.findFirst.mockResolvedValue({ oid: 3n, id: 'slateInvocation_1' });
  mocks.db.slateAttachmentUpload.create.mockImplementation(async ({ data }: any) => data);
  mocks.db.slateAttachmentUpload.updateMany.mockResolvedValue({ count: 1 });
  mocks.storage.startMultipartUpload.mockResolvedValue('upload_1');
  mocks.storage.abortMultipartUpload.mockResolvedValue(undefined);
  mocks.storage.getPartManifests.mockImplementation(
    async (_b: string, _k: string, _u: string, _e: number, parts: { number: number }[]) =>
      parts.map(part => ({
        number: part.number,
        url: 'https://metorial.example/object-storage/upload-part',
        manifest: `manifest-${part.number}`
      }))
  );
});

describe('live attachment registration', () => {
  it('hands out size-sealed parts on the upload route in multipart mode', async () => {
    let response = await post('/attachments', {
      attachments: [{ mimeType: 'image/png', sizeBytes: 40 * MiB }]
    });

    expect(response.status).toBe(200);
    let [attachment] = (await response.json()).attachments;
    expect(attachment).toMatchObject({
      uploadMethod: 'MULTIPART',
      partSizeBytes: 16 * MiB,
      partCount: 3
    });
    expect(attachment.parts.map((part: any) => [part.number, part.sizeBytes])).toEqual([
      [1, 16 * MiB],
      [2, 16 * MiB],
      [3, 8 * MiB]
    ]);
    expect(attachment.parts[0]).toMatchObject({
      url: 'http://object-upload.platform.metorial.internal/upload-part',
      method: 'PUT',
      headers: { 'x-metorial-upload-manifest': 'manifest-1' }
    });

    expect(mocks.storage.startMultipartUpload).toHaveBeenCalledWith(
      'invocations',
      expect.stringMatching(/^attachments\/uploads\//),
      'image/png'
    );
    expect(mocks.db.slateAttachmentUpload.create.mock.calls[0]![0].data).toMatchObject({
      declaredSizeBytes: 40 * MiB,
      partSizeBytes: 16 * MiB,
      multipartUploadId: 'upload_1'
    });
  });

  it('signs at most eight parts up front', async () => {
    let response = await post('/attachments', { attachments: [{ sizeBytes: 150 * MiB }] });

    let [attachment] = (await response.json()).attachments;
    expect(attachment.partCount).toBe(10);
    expect(attachment.parts.map((part: any) => part.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('requires a declared size in multipart mode', async () => {
    let response = await post('/attachments', { attachments: [{ mimeType: 'text/plain' }] });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'size_required' });
    expect(mocks.db.slateAttachmentUpload.create).not.toHaveBeenCalled();
  });

  it('rejects attachments above the maximum size before reserving anything', async () => {
    let response = await post('/attachments', { attachments: [{ sizeBytes: 201 * MiB }] });

    expect(response.status).toBe(413);
    expect(mocks.storage.startMultipartUpload).not.toHaveBeenCalled();
  });

  it('moves single PUT URLs onto the upload route and records the declared size', async () => {
    mocks.env.storage.SLATES_LIVE_UPLOAD_MODE = 'single';
    mocks.storage.getPublicURL.mockImplementation(async (bucket: string, key: string) => ({
      url: `https://metorial.example/object-storage/${bucket}/${key}?expires=1&purpose=upload&signature=s`,
      headers: {},
      expires_in: 300
    }));

    let response = await post('/attachments', { attachments: [{ sizeBytes: 12 }] });

    let [attachment] = (await response.json()).attachments;
    expect(attachment.uploadMethod).toBe('PUT');
    expect(attachment.uploadUrl).toBe(
      `http://object-upload.platform.metorial.internal/invocations/attachments/uploads/${attachment.referenceId}?expires=1&purpose=upload&signature=s`
    );
    expect(mocks.storage.startMultipartUpload).not.toHaveBeenCalled();
    expect(mocks.db.slateAttachmentUpload.create.mock.calls[0]![0].data).toMatchObject({
      declaredSizeBytes: 12,
      multipartUploadId: null
    });
  });
});

describe('live attachment parts', () => {
  it('signs only parts that exist and only for this invocation', async () => {
    mocks.db.slateAttachmentUpload.findFirst.mockResolvedValue(multipartUpload());

    let response = await post('/attachments/shau_1/parts', { numbers: [3, 3] });

    expect(response.status).toBe(200);
    expect((await response.json()).parts).toHaveLength(1);
    expect(mocks.storage.getPartManifests).toHaveBeenCalledWith(
      'invocations',
      'attachments/uploads/shau_1',
      'upload_1',
      300,
      [{ number: 3, size: 8 * MiB }]
    );
    expect(mocks.db.slateAttachmentUpload.findFirst.mock.calls[0]![0].where).toMatchObject({
      id: 'shau_1',
      status: 'pending',
      invocation: { id: 'slateInvocation_1' }
    });
  });

  it('refuses part numbers beyond the declared size', async () => {
    mocks.db.slateAttachmentUpload.findFirst.mockResolvedValue(multipartUpload());

    let response = await post('/attachments/shau_1/parts', { numbers: [4] });

    expect(response.status).toBe(400);
    expect(mocks.storage.getPartManifests).not.toHaveBeenCalled();
  });

  it('refuses more than eight parts per request', async () => {
    let response = await post('/attachments/shau_1/parts', {
      numbers: [1, 2, 3, 4, 5, 6, 7, 8, 9]
    });

    expect(response.status).toBe(400);
  });

  it('does not sign parts for single PUT uploads', async () => {
    mocks.db.slateAttachmentUpload.findFirst.mockResolvedValue(
      multipartUpload({ multipartUploadId: null, partSizeBytes: null })
    );

    let response = await post('/attachments/shau_1/parts', { numbers: [1] });

    expect(response.status).toBe(404);
  });
});

describe('live attachment completion', () => {
  it('needs one receipt per part', async () => {
    mocks.db.slateAttachmentUpload.findFirst.mockResolvedValue(multipartUpload());

    let response = await post('/attachments/shau_1/complete', { receipts: ['r1', 'r2'] });

    expect(response.status).toBe(400);
    expect(mocks.storage.completePublicMultipartUpload).not.toHaveBeenCalled();
  });

  it('completes through object storage and marks the upload uploaded', async () => {
    mocks.db.slateAttachmentUpload.findFirst.mockResolvedValue(multipartUpload());
    mocks.storage.completePublicMultipartUpload.mockResolvedValue({ size: 40 * MiB });

    let response = await post('/attachments/shau_1/complete', {
      receipts: ['r1', 'r2', 'r3']
    });

    expect(response.status).toBe(200);
    expect(mocks.storage.completePublicMultipartUpload).toHaveBeenCalledWith(
      'invocations',
      'attachments/uploads/shau_1',
      'upload_1',
      40 * MiB,
      16 * MiB,
      ['r1', 'r2', 'r3']
    );
    expect(mocks.db.slateAttachmentUpload.updateMany).toHaveBeenCalledWith({
      where: { oid: 7n, status: 'pending' },
      data: { status: 'uploaded', sizeBytes: 40 * MiB }
    });
  });

  it('reports rejected receipts without changing the upload', async () => {
    mocks.db.slateAttachmentUpload.findFirst.mockResolvedValue(multipartUpload());
    mocks.storage.completePublicMultipartUpload.mockRejectedValue(new Error('bad receipt'));

    let response = await post('/attachments/shau_1/complete', {
      receipts: ['r1', 'r2', 'r3']
    });

    expect(response.status).toBe(400);
    expect(mocks.db.slateAttachmentUpload.updateMany).not.toHaveBeenCalled();
  });

  it('aborts a discarded multipart upload', async () => {
    mocks.db.slateAttachmentUpload.findFirst.mockResolvedValue(multipartUpload());

    let response = await liveInvocationApp.request(
      '/slates-hub/live-invocation/attachments/shau_1',
      { method: 'DELETE', headers: { authorization: 'Bearer live-token' } }
    );

    expect(response.status).toBe(204);
    expect(mocks.storage.abortMultipartUpload).toHaveBeenCalledWith(
      'invocations',
      'attachments/uploads/shau_1',
      'upload_1'
    );
    expect(mocks.deleteQueue.add).toHaveBeenCalled();
  });
});

describe('live-only listener', () => {
  it('serves nothing but the live invocation API', async () => {
    for (let path of ['/ping', '/receive/abc', '/slates-hub/authorization']) {
      let response = await liveInvocationOnlyApp.request(path);
      expect(response.status).toBe(404);
    }

    let response = await liveInvocationOnlyApp.request(
      '/slates-hub/live-invocation/attachments',
      { method: 'POST', body: '{}' }
    );
    expect(response.status).toBe(401);
  });
});
