import { badRequestError, forbiddenError, ServiceError } from '@lowerdeck/error';
import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  db: {
    storeItem: {
      findFirst: vi.fn(),
      findMany: vi.fn()
    }
  },
  assertSkillWriteAccess: vi.fn(),
  assertStoreAccessForStore: vi.fn(),
  modifyStoreItems: vi.fn(),
  getDocumentById: vi.fn(),
  createDocument: vi.fn(),
  applyDocumentContent: vi.fn(),
  flushDocumentCollaborationState: vi.fn(),
  getDraftByDocumentId: vi.fn(),
  createUploadedFile: vi.fn(),
  updateFileExpiry: vi.fn(),
  getFileById: vi.fn(),
  downloadFileContent: vi.fn(),
  ensureGenericFilePurpose: vi.fn(),
  getSignedFileDownloadUrl: vi.fn()
}));

vi.mock('@metorial/db', () => ({ db: mocks.db }));

vi.mock('../lib/skillStoreLock', () => ({
  withSkillStoreMutationLock: vi.fn(
    async (_storeId: string, fn: () => Promise<unknown>) => await fn()
  )
}));

vi.mock('./skill', () => ({
  skillService: { assertSkillWriteAccess: mocks.assertSkillWriteAccess }
}));

vi.mock('@metorial/module-store', async () => {
  let { normalizeStorePath } =
    await import('../../../../../storage/modules/store/src/lib/storePath');
  let skillStorePath =
    await import('../../../../../storage/modules/store/src/lib/skillStorePath');

  return {
    ...skillStorePath,
    normalizeStorePath,
    storeReadPermission: 'content_read',
    storeAccessService: { assertStoreAccessForStore: mocks.assertStoreAccessForStore },
    storeItemMutationService: { modifyStoreItems: mocks.modifyStoreItems }
  };
});

vi.mock('@metorial/module-documents', () => ({
  documentService: {
    getDocumentById: mocks.getDocumentById,
    createDocument: mocks.createDocument
  },
  documentAuthoritativeWriteService: { applyDocumentContent: mocks.applyDocumentContent },
  flushDocumentCollaborationState: mocks.flushDocumentCollaborationState,
  internalDocumentDraftService: { getDraftByDocumentId: mocks.getDraftByDocumentId }
}));

vi.mock('@metorial/module-file', () => ({
  fileService: {
    createUploadedFile: mocks.createUploadedFile,
    updateFileExpiry: mocks.updateFileExpiry,
    getFileById: mocks.getFileById,
    downloadFileContent: mocks.downloadFileContent
  },
  filePurposeService: { ensureGenericFilePurpose: mocks.ensureGenericFilePurpose },
  getSignedFileDownloadUrl: mocks.getSignedFileDownloadUrl
}));

import { skillFileService } from './skillFile';

let sha256 = (content: string) => createHash('sha256').update(content).digest('hex');

let skill = {
  oid: 1n,
  id: 'skill_1',
  name: 'Release Notes',
  status: 'active',
  store: { oid: 2n, id: 'sto_1' }
} as any;

let access = {
  project: { oid: 10n },
  instance: { oid: 11n },
  auditScope: { type: 'test', context: { ip: '127.0.0.1', ua: 'test' } },
  authorization: { type: 'privileged', resourceActor: { oid: 12n, id: 'rac_1' } },
  skill
} as any;

let documentItem = (path: string, content: string) => ({
  id: `sti_${path}`,
  path,
  kind: 'document',
  updatedAt: new Date('2026-01-01'),
  file: { id: 'fil_doc', fileSize: 1 },
  document: { id: `doc_${path}`, content: { content } }
});

let fileItem = (path: string, fileId: string) => ({
  id: `sti_${path}`,
  path,
  kind: 'file',
  updatedAt: new Date('2026-01-01'),
  file: { id: fileId, fileSize: 42, storeId: 'blob' },
  document: null
});

let applyChanges = (changes: any[]) =>
  skillFileService.applySkillFileChanges({ ...access, changes });

let applyChange = (change: any) =>
  skillFileService.applySkillFileChange({ ...access, change });

describe('skillFileService', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.assertSkillWriteAccess.mockResolvedValue(undefined);
    mocks.assertStoreAccessForStore.mockResolvedValue(undefined);
    mocks.getFileById.mockResolvedValue({ id: 'fil_up', status: 'active' });
    mocks.db.storeItem.findFirst.mockResolvedValue(null);
    mocks.db.storeItem.findMany.mockResolvedValue([]);
    mocks.getDraftByDocumentId.mockResolvedValue(null);
    mocks.ensureGenericFilePurpose.mockResolvedValue({ id: 'fpu_generic' });
    mocks.createUploadedFile.mockResolvedValue({ id: 'fil_new' });
    mocks.updateFileExpiry.mockResolvedValue(undefined);
    mocks.modifyStoreItems.mockReset().mockResolvedValue(undefined);
    mocks.createDocument.mockResolvedValue({ id: 'doc_new' });
  });

  it('rejects paths that the store would silently rewrite', async () => {
    await expect(
      applyChanges([{ type: 'put', path: '/bad*name.md', content: 'x' }])
    ).rejects.toMatchObject({ data: { status: 400 } });

    expect(mocks.createDocument).not.toHaveBeenCalled();
    expect(mocks.modifyStoreItems).not.toHaveBeenCalled();
  });

  it('creates markdown files as documents at the given path', async () => {
    await applyChanges([
      { type: 'put', path: 'references/api.md', content: '# API Reference\n\nBody' }
    ]);

    expect(mocks.createDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          title: 'API Reference',
          content: '# API Reference\n\nBody',
          store: { id: 'sto_1', path: '/references/api.md' }
        })
      })
    );
    expect(mocks.createUploadedFile).not.toHaveBeenCalled();
  });

  it('titles a new root SKILL.md after the skill', async () => {
    await applyChanges([{ type: 'put', path: '/SKILL.md', content: '# Something else' }]);

    expect(mocks.createDocument).toHaveBeenCalledWith(
      expect.objectContaining({ input: expect.objectContaining({ title: 'Release Notes' }) })
    );
  });

  it('stores non-markdown text content as an uploaded file', async () => {
    await applyChanges([{ type: 'put', path: '/scripts/run.py', content: 'print(1)' }]);

    expect(mocks.createUploadedFile).toHaveBeenCalledWith(
      expect.objectContaining({
        purpose: 'fpu_generic',
        input: expect.objectContaining({ name: 'run.py', mimeType: 'text/x-python' })
      })
    );
    expect(mocks.modifyStoreItems).toHaveBeenCalledWith(
      expect.objectContaining({
        operations: [{ type: 'add', path: '/scripts/run.py', fileId: 'fil_new' }]
      })
    );
  });

  it('writes existing documents through the authoritative write path', async () => {
    mocks.db.storeItem.findFirst.mockResolvedValue(documentItem('/SKILL.md', 'old'));
    mocks.getDocumentById.mockResolvedValue({ id: 'doc_/SKILL.md', title: 'Release Notes' });

    await applyChanges([
      { type: 'put', path: '/SKILL.md', content: 'new', ifMatch: sha256('old') }
    ]);

    expect(mocks.flushDocumentCollaborationState).toHaveBeenCalledWith({
      documentId: 'doc_/SKILL.md'
    });
    expect(mocks.applyDocumentContent).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({ title: 'Release Notes', content: 'new' })
      })
    );
  });

  it('attributes document edits to the actor and context of the change', async () => {
    mocks.db.storeItem.findFirst.mockResolvedValue(documentItem('/SKILL.md', 'old'));
    mocks.getDocumentById.mockResolvedValue({ id: 'doc_/SKILL.md', title: 'Release Notes' });

    await applyChanges([{ type: 'put', path: '/SKILL.md', content: 'new' }]);

    expect(mocks.applyDocumentContent).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          authorization: {
            type: 'privileged',
            resourceActor: access.authorization.resourceActor
          },
          context: access.auditScope.context
        })
      })
    );
  });

  it('rejects a write when the etag no longer matches', async () => {
    mocks.db.storeItem.findFirst.mockResolvedValue(documentItem('/SKILL.md', 'old'));
    mocks.getDraftByDocumentId.mockResolvedValue({ content: 'edited by someone else' });

    await expect(
      applyChange({ type: 'put', path: '/SKILL.md', content: 'new', ifMatch: sha256('old') })
    ).rejects.toMatchObject({
      data: {
        status: 412,
        code: 'skill_file_changed',
        message: 'The skill file "/SKILL.md" was changed by someone else since you read it'
      }
    });

    expect(mocks.applyDocumentContent).not.toHaveBeenCalled();
  });

  it('rejects a create-only write when the file already exists', async () => {
    mocks.db.storeItem.findFirst.mockResolvedValue(fileItem('/assets/logo.png', 'fil_old'));

    await expect(
      applyChange({ type: 'put', path: '/assets/logo.png', fileId: 'fil_up', ifMatch: null })
    ).rejects.toMatchObject({
      data: {
        status: 412,
        code: 'skill_file_exists',
        message: 'A file already exists at "/assets/logo.png"'
      }
    });
    expect(mocks.modifyStoreItems).not.toHaveBeenCalled();
  });

  it('rejects a write against an etag when the file no longer exists', async () => {
    await expect(
      applyChange({ type: 'put', path: '/notes.txt', content: 'x', ifMatch: 'fil_gone' })
    ).rejects.toMatchObject({
      data: {
        status: 412,
        code: 'skill_file_missing',
        message: 'The skill file "/notes.txt" no longer exists'
      }
    });
    expect(mocks.createUploadedFile).not.toHaveBeenCalled();
  });

  it('does not let a consumer attach a file they cannot read', async () => {
    let consumerAuthorization = {
      type: 'restricted',
      resourceActor: { oid: 12n, id: 'rac_consumer' },
      accessTags: []
    };
    mocks.getFileById.mockRejectedValue(
      new ServiceError(forbiddenError({ message: 'Missing access' }))
    );

    await expect(
      skillFileService.applySkillFileChanges({
        ...access,
        authorization: consumerAuthorization,
        changes: [{ type: 'put', path: '/assets/logo.png', fileId: 'fil_up' }]
      })
    ).rejects.toMatchObject({ data: { status: 404 } });

    expect(mocks.getFileById).toHaveBeenCalledWith(
      expect.objectContaining({ fileId: 'fil_up', authorization: consumerAuthorization })
    );
    expect(mocks.modifyStoreItems).not.toHaveBeenCalled();
  });

  it('does not attach a deleted file', async () => {
    mocks.getFileById.mockResolvedValue({ id: 'fil_up', status: 'deleted' });

    await expect(
      applyChanges([{ type: 'put', path: '/assets/logo.png', fileId: 'fil_up' }])
    ).rejects.toMatchObject({ data: { status: 404 } });

    expect(mocks.modifyStoreItems).not.toHaveBeenCalled();
  });

  it('does not attach the file backing a document', async () => {
    mocks.getFileById.mockResolvedValue({
      id: 'fil_doc',
      status: 'active',
      document: { id: 'doc_other' }
    });

    await expect(
      applyChanges([{ type: 'put', path: '/notes.md', fileId: 'fil_doc' }])
    ).rejects.toMatchObject({
      data: { status: 400, description: 'Use content to write markdown documents.' }
    });

    expect(mocks.modifyStoreItems).not.toHaveBeenCalled();
    expect(mocks.applyDocumentContent).not.toHaveBeenCalled();
  });

  it('attaches a readable file at the path', async () => {
    await applyChanges([{ type: 'put', path: '/assets/logo.png', fileId: 'fil_up' }]);

    expect(mocks.modifyStoreItems).toHaveBeenCalledWith(
      expect.objectContaining({
        operations: [{ type: 'add', path: '/assets/logo.png', fileId: 'fil_up' }]
      })
    );
  });

  it('requires exactly one of content or file id', async () => {
    await expect(applyChanges([{ type: 'put', path: '/notes.txt' }])).rejects.toMatchObject({
      data: { status: 400 }
    });
  });

  it('returns not found when deleting a missing file', async () => {
    await expect(
      applyChanges([{ type: 'delete', path: '/missing.md' }])
    ).rejects.toMatchObject({ data: { status: 404 } });
  });

  it('refuses to move a file onto its own path', async () => {
    await expect(
      applyChanges([{ type: 'move', path: '/a.txt', toPath: 'a.txt' }])
    ).rejects.toMatchObject({ data: { status: 400 } });

    expect(mocks.db.storeItem.findFirst).not.toHaveBeenCalled();
  });

  it('refuses to move a file onto an existing path', async () => {
    mocks.db.storeItem.findFirst
      .mockResolvedValueOnce(fileItem('/a.txt', 'fil_a'))
      .mockResolvedValueOnce(fileItem('/b.txt', 'fil_b'));

    await expect(
      applyChanges([{ type: 'move', path: '/a.txt', toPath: '/b.txt' }])
    ).rejects.toMatchObject({ data: { status: 409 } });

    expect(mocks.modifyStoreItems).not.toHaveBeenCalled();
  });

  it('does not touch the store when write access is denied', async () => {
    mocks.assertSkillWriteAccess.mockRejectedValue(new Error('forbidden'));

    await expect(
      applyChanges([{ type: 'put', path: '/SKILL.md', content: 'x' }])
    ).rejects.toThrow('forbidden');

    expect(mocks.db.storeItem.findFirst).not.toHaveBeenCalled();
    expect(mocks.createDocument).not.toHaveBeenCalled();
  });

  it.each([
    [{ type: 'put', path: '/bad*name.txt', content: 'x' }],
    [{ type: 'put', path: '/notes.txt' }],
    [{ type: 'put', path: '/big.txt', content: 'x'.repeat(5 * 1024 * 1024 + 1) }],
    [{ type: 'put', path: '/SKILL.md', fileId: 'fil_up' }],
    [{ type: 'put', path: '/agents/reviewer.txt', content: 'x' }],
    [{ type: 'put', path: '/agents/reviewer.markdown', content: 'x' }],
    [{ type: 'put', path: '/agents/Reviewer.MD', fileId: 'fil_up' }],
    [{ type: 'delete', path: '/SKILL.md' }],
    [{ type: 'move', path: '/SKILL.md', toPath: '/README.md' }],
    [{ type: 'move', path: '/a.txt', toPath: '/agents/a.txt' }]
  ])('validates every change before applying any: %o', async invalidChange => {
    await expect(
      applyChanges([
        { type: 'put', path: '/scripts/run.py', content: 'print(1)' },
        invalidChange
      ])
    ).rejects.toMatchObject({
      data: { status: 400, message: expect.stringMatching(/^changes\[1\]: /) }
    });

    expect(mocks.db.storeItem.findFirst).not.toHaveBeenCalled();
    expect(mocks.createUploadedFile).not.toHaveBeenCalled();
    expect(mocks.modifyStoreItems).not.toHaveBeenCalled();
  });

  it('checks attached files before applying any change', async () => {
    mocks.getFileById.mockResolvedValue({ id: 'fil_up', status: 'deleted' });

    await expect(
      applyChanges([
        { type: 'delete', path: '/old.md' },
        { type: 'put', path: '/assets/logo.png', fileId: 'fil_up' }
      ])
    ).rejects.toMatchObject({
      data: { status: 404, message: expect.stringMatching(/^changes\[1\]: /) }
    });

    expect(mocks.modifyStoreItems).not.toHaveBeenCalled();
  });

  it('prefixes errors with the change index in batches, even for a single change', async () => {
    mocks.db.storeItem.findFirst.mockResolvedValue(fileItem('/assets/logo.png', 'fil_old'));

    await expect(
      applyChanges([
        { type: 'put', path: '/assets/logo.png', fileId: 'fil_up', ifMatch: null }
      ])
    ).rejects.toMatchObject({
      data: {
        status: 412,
        code: 'skill_file_exists',
        message: 'changes[0]: A file already exists at "/assets/logo.png"'
      }
    });
  });

  it('does not prefix validation errors of a single change', async () => {
    mocks.getFileById.mockResolvedValue({ id: 'fil_up', status: 'deleted' });

    await expect(
      applyChange({ type: 'put', path: '/assets/logo.png', fileId: 'fil_up' })
    ).rejects.toMatchObject({
      data: { status: 404, message: expect.not.stringMatching(/^changes\[/) }
    });
  });

  it('reports which change failed while applying and how many were already applied', async () => {
    await expect(
      applyChanges([
        { type: 'put', path: '/scripts/run.py', content: 'print(1)' },
        { type: 'put', path: '/scripts/other.py', content: 'print(2)' },
        { type: 'delete', path: '/missing.txt' }
      ])
    ).rejects.toMatchObject({
      data: {
        status: 404,
        message: expect.stringMatching(/^changes\[2\]: .*\(2 earlier changes were applied\)$/)
      }
    });

    expect(mocks.modifyStoreItems).toHaveBeenCalledTimes(2);
  });

  it('keeps the status and code of store rejections while applying', async () => {
    mocks.modifyStoreItems
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(
        new ServiceError(badRequestError({ code: 'store_full', message: 'Store is full' }))
      );

    await expect(
      applyChanges([
        { type: 'put', path: '/assets/a.png', fileId: 'fil_up' },
        { type: 'put', path: '/assets/b.png', fileId: 'fil_up' }
      ])
    ).rejects.toMatchObject({
      data: {
        status: 400,
        code: 'store_full',
        message: 'changes[1]: Store is full (1 earlier change was applied)'
      }
    });
  });

  it('expires the uploaded file when the store rejects it', async () => {
    mocks.modifyStoreItems.mockRejectedValue(
      new ServiceError(badRequestError({ message: 'Store is full' }))
    );

    await expect(
      applyChange({ type: 'put', path: '/scripts/run.py', content: 'print(1)' })
    ).rejects.toMatchObject({ data: { status: 400, message: 'Store is full' } });

    expect(mocks.updateFileExpiry).toHaveBeenCalledWith({
      file: { id: 'fil_new' },
      expiresAt: expect.any(Date)
    });
  });

  it('does not expire an attached file when the store rejects it', async () => {
    mocks.modifyStoreItems.mockRejectedValue(
      new ServiceError(badRequestError({ message: 'Store is full' }))
    );

    await expect(
      applyChanges([{ type: 'put', path: '/assets/logo.png', fileId: 'fil_up' }])
    ).rejects.toMatchObject({ data: { status: 400 } });

    expect(mocks.updateFileExpiry).not.toHaveBeenCalled();
  });

  it('accepts agent documents regardless of the markdown extension case', async () => {
    mocks.db.storeItem.findFirst.mockImplementation(async ({ where }: any) =>
      where.path === '/notes.md' ? documentItem('/notes.md', 'x') : null
    );

    await applyChanges([
      { type: 'put', path: '/agents/Reviewer.MD', content: '# Reviewer' },
      { type: 'move', path: '/notes.md', toPath: '/agents/Notes.Md' }
    ]);

    expect(mocks.createDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          store: { id: 'sto_1', path: '/agents/Reviewer.MD' }
        })
      })
    );
    expect(mocks.modifyStoreItems).toHaveBeenCalledWith(
      expect.objectContaining({
        operations: [{ type: 'modify', itemId: 'sti_/notes.md', path: '/agents/Notes.Md' }]
      })
    );
  });

  it('returns the result of every change in order', async () => {
    let items: Record<string, unknown> = {
      '/old.md': documentItem('/old.md', 'x'),
      '/a.txt': fileItem('/a.txt', 'fil_a')
    };
    mocks.db.storeItem.findFirst.mockImplementation(
      async ({ where }: any) => items[where.path] ?? null
    );
    mocks.modifyStoreItems.mockImplementation(async ({ operations: [operation] }: any) => {
      if (operation.type === 'remove') delete items['/old.md'];
      if (operation.type === 'modify') {
        delete items['/a.txt'];
        items[operation.path] = fileItem(operation.path, 'fil_a');
      }
    });

    let results = await applyChanges([
      { type: 'delete', path: 'old.md' },
      { type: 'move', path: '/a.txt', toPath: '/b.txt' }
    ]);

    expect(results).toEqual([
      { type: 'delete', path: '/old.md', previousPath: null, file: null },
      {
        type: 'move',
        path: '/b.txt',
        previousPath: '/a.txt',
        file: expect.objectContaining({ path: '/b.txt', kind: 'file', fileId: 'fil_a' })
      }
    ]);
  });

  it('lists files with draft-aware document etags', async () => {
    mocks.db.storeItem.findMany.mockResolvedValue([
      documentItem('/SKILL.md', 'persisted'),
      fileItem('/assets/logo.png', 'fil_logo')
    ]);
    mocks.getDraftByDocumentId.mockResolvedValue({ content: 'drafted' });

    let files = await skillFileService.listSkillFiles(access);

    expect(files).toEqual([
      expect.objectContaining({
        path: '/SKILL.md',
        kind: 'document',
        etag: sha256('drafted')
      }),
      expect.objectContaining({
        path: '/assets/logo.png',
        kind: 'file',
        etag: 'fil_logo',
        size: 42
      })
    ]);
    expect(mocks.flushDocumentCollaborationState).not.toHaveBeenCalled();
  });
  describe('readSkillFileText', () => {
    let read = (d: { path: string; maxBytes?: number }) =>
      skillFileService.readSkillFileText({ ...access, ...d });

    it('returns document content without downloading anything', async () => {
      mocks.db.storeItem.findFirst.mockResolvedValue(documentItem('/SKILL.md', '# Notes'));

      let file = await read({ path: '/SKILL.md' });

      expect(file).toMatchObject({ path: '/SKILL.md', kind: 'document', content: '# Notes' });
      expect(mocks.downloadFileContent).not.toHaveBeenCalled();
    });

    it('reads stored text files from file storage', async () => {
      let item = fileItem('/scripts/run.py', 'fil_run');
      mocks.db.storeItem.findFirst.mockResolvedValue(item);
      mocks.downloadFileContent.mockResolvedValue(Buffer.from('print("hi")'));

      let file = await read({ path: 'scripts/run.py' });

      expect(file).toMatchObject({
        path: '/scripts/run.py',
        kind: 'file',
        content: 'print("hi")'
      });
      expect(mocks.downloadFileContent).toHaveBeenCalledWith({ file: item.file });
      expect(mocks.assertStoreAccessForStore).toHaveBeenCalled();
    });

    it.each([
      ['NUL bytes', Buffer.from([104, 0, 105])],
      ['invalid UTF-8', Buffer.from([0xff, 0xfe, 0xfd])]
    ])('reports binary content for %s', async (_name, bytes) => {
      mocks.db.storeItem.findFirst.mockResolvedValue(fileItem('/assets/a.bin', 'fil_a'));
      mocks.downloadFileContent.mockResolvedValue(bytes);

      expect(await read({ path: '/assets/a.bin' })).toMatchObject({ content: null });
    });

    it('refuses files whose recorded size exceeds the limit before downloading', async () => {
      mocks.db.storeItem.findFirst.mockResolvedValue(fileItem('/assets/a.bin', 'fil_a'));

      await expect(read({ path: '/assets/a.bin', maxBytes: 10 })).rejects.toMatchObject({
        data: { status: 400, code: 'skill_file_too_large' }
      });
      expect(mocks.downloadFileContent).not.toHaveBeenCalled();
    });

    it('enforces the limit on the downloaded bytes', async () => {
      mocks.db.storeItem.findFirst.mockResolvedValue(fileItem('/notes.txt', 'fil_notes'));
      mocks.downloadFileContent.mockResolvedValue(Buffer.from('x'.repeat(100)));

      await expect(read({ path: '/notes.txt', maxBytes: 50 })).rejects.toMatchObject({
        data: { status: 400, code: 'skill_file_too_large' }
      });
    });

    it('returns not found for a missing file', async () => {
      await expect(read({ path: '/missing.txt' })).rejects.toMatchObject({
        data: { status: 404 }
      });
    });
  });
});
