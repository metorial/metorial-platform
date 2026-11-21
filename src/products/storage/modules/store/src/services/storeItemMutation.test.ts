import { forbiddenError, ServiceError } from '@lowerdeck/error';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  db: {
    document: { findFirst: vi.fn() },
    file: { findFirst: vi.fn() }
  },
  withTransaction: vi.fn(),
  assertStoreAccessForDocument: vi.fn(),
  assertStoreAccessForFile: vi.fn()
}));

vi.mock('@metorial/db', () => ({
  db: mocks.db,
  ID: { generateId: vi.fn() },
  withTransaction: mocks.withTransaction
}));

vi.mock('@metorial/fabric', () => ({ Fabric: { fire: vi.fn() } }));

vi.mock('@metorial/module-file', () => ({
  fileLinkService: {},
  fileReferenceService: {}
}));

vi.mock('../lib/storeByteSize', () => ({
  applyStoreByteSizeDelta: vi.fn(),
  refreshStoreByteSize: vi.fn()
}));

vi.mock('../queues/lifecycle', () => ({ enqueueStoreLifecycle: vi.fn() }));

vi.mock('./storeItem', () => ({ storeItemInclude: {} }));

vi.mock('./storeVersion', () => ({ storeVersionService: {} }));

vi.mock('./storeAccess', () => ({
  storeWritePermission: 'content_write',
  storeAccessService: {
    assertStoreAccessForDocument: mocks.assertStoreAccessForDocument,
    assertStoreAccessForFile: mocks.assertStoreAccessForFile
  }
}));

import { storeItemMutationService } from './storeItemMutation';

let transactionStarted = new Error('transaction started');

let scope: any = {
  project: { oid: 6n, id: 'prj_1' },
  instance: { oid: 7n, id: 'ins_1' },
  auditScope: { type: 'test' },
  store: { oid: 4n, id: 'sto_1', pathMode: 'default', isReadOnly: false }
};

let consumerAccess: any = {
  authorization: {
    type: 'restricted',
    resourceActor: { oid: 30n, id: 'rac_consumer', consumerProfileOid: 31n },
    accessTags: [{ accessTagOid: 5n }]
  }
};

let memberAccess: any = {
  authorization: { type: 'privileged', resourceActor: { oid: 3n, id: 'rac_member' } },
  defaultPermissions: ['content_read', 'content_write'],
  overridePermissions: true
};

let file = {
  oid: 50n,
  id: 'fil_1',
  status: 'active',
  fileSize: 1n,
  createdByResourceActorOid: 99n,
  purpose: { canHaveLinks: true },
  document: null
};

let document = {
  oid: 60n,
  id: 'doc_1',
  fileOid: 51n,
  isReadOnly: false,
  createdByResourceActorOid: 99n,
  file: { ...file, oid: 51n, id: 'fil_doc' }
};

let missingAccess = (message: string) => new ServiceError(forbiddenError({ message }));

let modify = (d: { operations: any[]; targetAccess?: any }) =>
  storeItemMutationService.modifyStoreItems({ ...scope, ...d });

describe('storeItemMutationService.modifyStoreItems target access', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.db.file.findFirst.mockResolvedValue(file);
    mocks.db.document.findFirst.mockResolvedValue(document);
    mocks.withTransaction.mockRejectedValue(transactionStarted);
    mocks.assertStoreAccessForFile.mockResolvedValue(undefined);
    mocks.assertStoreAccessForDocument.mockResolvedValue(undefined);
  });

  it('reports a file the consumer cannot write as not found when adding it', async () => {
    mocks.assertStoreAccessForFile.mockRejectedValue(missingAccess('no file access'));

    await expect(
      modify({
        operations: [{ type: 'add', path: 'a.txt', fileId: file.id }],
        targetAccess: consumerAccess
      })
    ).rejects.toMatchObject({ data: { code: 'not_found' } });

    expect(mocks.assertStoreAccessForFile).toHaveBeenCalledWith(
      expect.objectContaining({
        file,
        authorization: consumerAccess.authorization,
        requiredPermission: 'content_write'
      })
    );
    expect(mocks.withTransaction).not.toHaveBeenCalled();
  });

  it('reports a document the consumer cannot write as not found when adding it', async () => {
    mocks.assertStoreAccessForDocument.mockRejectedValue(missingAccess('no document access'));

    await expect(
      modify({
        operations: [{ type: 'add', path: 'a.md', documentId: document.id }],
        targetAccess: consumerAccess
      })
    ).rejects.toMatchObject({ data: { code: 'not_found' } });

    expect(mocks.assertStoreAccessForDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        document,
        authorization: consumerAccess.authorization,
        requiredPermission: 'content_write'
      })
    );
    expect(mocks.withTransaction).not.toHaveBeenCalled();
  });

  it('checks the new target when an existing item is pointed at another file', async () => {
    mocks.assertStoreAccessForFile.mockRejectedValue(missingAccess('no file access'));

    await expect(
      modify({
        operations: [{ type: 'modify', itemId: 'sti_1', fileId: file.id }],
        targetAccess: consumerAccess
      })
    ).rejects.toMatchObject({ data: { code: 'not_found' } });

    expect(mocks.withTransaction).not.toHaveBeenCalled();
  });

  it('lets a consumer attach a target they can already write', async () => {
    await expect(
      modify({
        operations: [
          { type: 'add', path: 'a.txt', fileId: file.id },
          { type: 'add', path: 'a.md', documentId: document.id }
        ],
        targetAccess: consumerAccess
      })
    ).rejects.toBe(transactionStarted);

    expect(mocks.assertStoreAccessForFile).toHaveBeenCalledTimes(1);
    expect(mocks.assertStoreAccessForDocument).toHaveBeenCalledTimes(1);
  });

  it('does not check targets for consumer operations without one', async () => {
    await expect(
      modify({
        operations: [
          { type: 'add', path: 'dir/' },
          { type: 'modify', itemId: 'sti_1', path: 'renamed.txt' },
          { type: 'remove', itemId: 'sti_2' }
        ],
        targetAccess: consumerAccess
      })
    ).rejects.toBe(transactionStarted);

    expect(mocks.assertStoreAccessForFile).not.toHaveBeenCalled();
    expect(mocks.assertStoreAccessForDocument).not.toHaveBeenCalled();
  });

  it('does not check targets for privileged callers', async () => {
    await expect(
      modify({
        operations: [
          { type: 'add', path: 'a.txt', fileId: file.id },
          { type: 'add', path: 'a.md', documentId: document.id }
        ],
        targetAccess: memberAccess
      })
    ).rejects.toBe(transactionStarted);

    expect(mocks.assertStoreAccessForFile).not.toHaveBeenCalled();
    expect(mocks.assertStoreAccessForDocument).not.toHaveBeenCalled();
  });

  it('does not check targets for internal callers that pass no access', async () => {
    await expect(
      modify({ operations: [{ type: 'add', path: 'a.txt', fileId: file.id }] })
    ).rejects.toBe(transactionStarted);

    expect(mocks.assertStoreAccessForFile).not.toHaveBeenCalled();
  });

  it('keeps unrelated access errors intact', async () => {
    let failure = new Error('database unavailable');
    mocks.assertStoreAccessForFile.mockRejectedValue(failure);

    await expect(
      modify({
        operations: [{ type: 'add', path: 'a.txt', fileId: file.id }],
        targetAccess: consumerAccess
      })
    ).rejects.toBe(failure);
  });
});
