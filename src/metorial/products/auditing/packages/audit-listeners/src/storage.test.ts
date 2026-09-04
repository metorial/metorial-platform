import { beforeEach, describe, expect, it, vi } from 'vitest';

let { recordEvent, recordEvents, addAfterTransactionHook } = vi.hoisted(() => ({
  recordEvent: vi.fn(),
  recordEvents: vi.fn(),
  addAfterTransactionHook: vi.fn(async (hook: () => Promise<void>) => await hook())
}));

vi.mock('@metorial/module-audit-tracker', () => ({
  auditTrackerService: {
    recordEvent,
    recordEvents
  }
}));

vi.mock('@metorial/db', () => ({
  addAfterTransactionHook
}));

vi.mock('@metorial/fabric', () => ({
  Fabric: {
    listen: vi.fn()
  }
}));

import {
  recordDocumentCreated,
  recordDocumentVersionSealed,
  recordDocumentDeleted,
  recordFileCreated,
  recordFileDeleted,
  recordStoreCreated,
  recordStoreDeleted,
  recordStoreItemsModified,
  recordStoreUpdated
} from './storage';

let auditScope = {
  organizationOid: 1n,
  instanceOid: 3n,
  organizationActorOid: 4n,
  actor: {
    type: 'org_actor' as const,
    id: 'oac_1'
  },
  context: {
    ip: '127.0.0.1'
  }
};

let file = {
  id: 'fil_1',
  status: 'active',
  fileName: 'notes.txt',
  fileSize: 12,
  fileType: 'text/plain',
  title: 'Notes',
  storeId: 'obj_key_1',
  isReadOnly: false,
  isInternal: false,
  expiresAt: null,
  purpose: { slug: 'generic' }
};

let store = {
  id: 'str_1',
  name: 'Docs',
  access: 'private',
  itemCount: 3,
  byteSize: 4096n,
  isReadOnly: false,
  cloneType: null
};

let document = {
  id: 'doc_1',
  title: 'Design notes',
  isReadOnly: false,
  file: { id: 'fil_1' },
  parentDocument: null,
  currentVersion: { id: 'dcv_1' },
  content: { content: 'hello' }
};

describe('storage audit listeners', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    recordEvent.mockResolvedValue(undefined);
    recordEvents.mockResolvedValue(undefined);
  });

  it('records a file creation without copying its contents', async () => {
    await recordFileCreated({ auditScope, file } as any);

    expect(recordEvent).toHaveBeenCalledWith(auditScope, 'file', 'create', {
      payload: {
        id: 'fil_1',
        status: 'active',
        fileName: 'notes.txt',
        fileSize: 12,
        fileType: 'text/plain',
        title: 'Notes',
        purposeSlug: 'generic',
        storeId: 'obj_key_1',
        isReadOnly: false,
        expiresAt: null
      },
      recordedAt: expect.any(Date)
    });
  });

  it('records a file deletion', async () => {
    await recordFileDeleted({ auditScope, file } as any);

    expect(recordEvent).toHaveBeenCalledWith(
      auditScope,
      'file',
      'delete',
      expect.objectContaining({ payload: expect.objectContaining({ id: 'fil_1' }) })
    );
  });

  it('skips files that back a document, which the document events already cover', async () => {
    await recordFileCreated({
      auditScope,
      file: { ...file, purpose: { slug: 'document' } }
    } as any);

    expect(recordEvent).not.toHaveBeenCalled();
  });

  it('skips internal files', async () => {
    await recordFileCreated({ auditScope, file: { ...file, isInternal: true } } as any);

    expect(recordEvent).not.toHaveBeenCalled();
  });

  it('skips files with no attributable scope', async () => {
    await recordFileCreated({ auditScope: undefined, file } as any);

    expect(recordEvent).not.toHaveBeenCalled();
  });

  it('records a document by reference, storing its size rather than its content', async () => {
    await recordDocumentCreated({ auditScope, document } as any);

    expect(recordEvent).toHaveBeenCalledWith(auditScope, 'document', 'create', {
      payload: {
        id: 'doc_1',
        title: 'Design notes',
        fileId: 'fil_1',
        parentDocumentId: null,
        isReadOnly: false,
        currentVersionId: 'dcv_1',
        byteSize: 5
      },
      recordedAt: expect.any(Date)
    });

    let [, , , event] = recordEvent.mock.calls[0]!;
    expect(JSON.stringify(event.payload)).not.toContain('hello');
  });

  it('carries the parent document id for a cloned document', async () => {
    await recordDocumentCreated({
      auditScope,
      document: { ...document, parentDocument: { id: 'doc_parent' } }
    } as any);

    expect(recordEvent).toHaveBeenCalledWith(
      auditScope,
      'document',
      'create',
      expect.objectContaining({
        payload: expect.objectContaining({ parentDocumentId: 'doc_parent' })
      })
    );
  });

  it('records a document deletion', async () => {
    await recordDocumentDeleted({ auditScope, document } as any);

    expect(recordEvent).toHaveBeenCalledWith(
      auditScope,
      'document',
      'delete',
      expect.objectContaining({ payload: expect.objectContaining({ id: 'doc_1' }) })
    );
  });

  it('records a store creation with its byte size narrowed to a number', async () => {
    await recordStoreCreated({ auditScope, store } as any);

    expect(recordEvent).toHaveBeenCalledWith(auditScope, 'store', 'create', {
      payload: {
        id: 'str_1',
        name: 'Docs',
        access: 'private',
        itemCount: 3,
        byteSize: 4096,
        isReadOnly: false,
        cloneType: null
      },
      recordedAt: expect.any(Date)
    });
  });

  it('records a store update with its previous state for diffing', async () => {
    await recordStoreUpdated({
      auditScope,
      store: { ...store, name: 'Renamed' },
      previousStore: store
    } as any);

    expect(recordEvent).toHaveBeenCalledWith(
      auditScope,
      'store',
      'update',
      expect.objectContaining({
        payload: expect.objectContaining({ name: 'Renamed' }),
        previousPayload: expect.objectContaining({ name: 'Docs' })
      })
    );
  });

  it('records a store deletion', async () => {
    await recordStoreDeleted({ auditScope, store } as any);

    expect(recordEvent).toHaveBeenCalledWith(
      auditScope,
      'store',
      'delete',
      expect.objectContaining({ payload: expect.objectContaining({ id: 'str_1' }) })
    );
  });

  it('records one event for a whole batch of store item operations', async () => {
    let operations = [
      { type: 'add', kind: 'document', path: '/SKILL.md', itemId: 'sti_1' },
      { type: 'remove', kind: 'file', path: '/old.txt', itemId: 'sti_2' }
    ];

    await recordStoreItemsModified({
      auditScope,
      store,
      skill: { id: 'skl_1' },
      operations,
      counts: { add: 1, modify: 0, remove: 1 },
      truncated: false
    } as any);

    expect(recordEvent).toHaveBeenCalledTimes(1);
    expect(recordEvent).toHaveBeenCalledWith(auditScope, 'store_items', 'modify', {
      payload: {
        storeId: 'str_1',
        storeName: 'Docs',
        skillId: 'skl_1',
        counts: { add: 1, modify: 0, remove: 1 },
        operations,
        truncated: false
      },
      recordedAt: expect.any(Date)
    });
  });

  it('reports a truncated operation list without losing the counts', async () => {
    await recordStoreItemsModified({
      auditScope,
      store,
      skill: null,
      operations: [{ type: 'add', kind: 'file', path: '/a.txt', itemId: 'sti_1' }],
      counts: { add: 120, modify: 0, remove: 0 },
      truncated: true
    } as any);

    expect(recordEvent).toHaveBeenCalledWith(
      auditScope,
      'store_items',
      'modify',
      expect.objectContaining({
        payload: expect.objectContaining({
          skillId: null,
          counts: { add: 120, modify: 0, remove: 0 },
          truncated: true
        })
      })
    );
  });

  it('records every storage event only after the transaction commits', async () => {
    await recordStoreCreated({ auditScope, store } as any);

    expect(addAfterTransactionHook).toHaveBeenCalledTimes(1);
    expect(addAfterTransactionHook.mock.invocationCallOrder[0]).toBeLessThan(
      recordEvent.mock.invocationCallOrder[0]!
    );
  });

  it('records one edit per participant when a version is sealed, in one batch', async () => {
    let editorScope = (id: string) => ({ ...auditScope, actor: { type: 'org_actor', id } });

    await recordDocumentVersionSealed({
      document: { id: 'doc_1', title: 'Design notes' },
      version: {
        id: 'dver_4',
        versionNumber: 4,
        byteSize: 120,
        editedAt: new Date('2026-08-20T10:00:00.000Z')
      },
      previousVersionId: 'dver_3',
      editors: [{ auditScope: editorScope('oac_1') }, { auditScope: editorScope('oac_2') }]
    } as any);

    expect(recordEvent).not.toHaveBeenCalled();
    expect(recordEvents).toHaveBeenCalledTimes(1);

    let [events] = recordEvents.mock.calls[0]!;
    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({
      scope: editorScope('oac_1'),
      resource: 'document',
      action: 'edit',
      payload: {
        id: 'doc_1',
        title: 'Design notes',
        versionId: 'dver_4',
        versionNumber: 4,
        previousVersionId: 'dver_3',
        byteSize: 120,
        editedAt: new Date('2026-08-20T10:00:00.000Z')
      },
      recordedAt: new Date('2026-08-20T10:00:00.000Z')
    });
    expect(events[1].scope).toEqual(editorScope('oac_2'));
  });

  it('links the version rather than carrying the document content', async () => {
    await recordDocumentVersionSealed({
      document: { id: 'doc_1', title: 'Design notes' },
      version: {
        id: 'dver_4',
        versionNumber: 4,
        byteSize: 120,
        editedAt: new Date('2026-08-20T10:00:00.000Z')
      },
      previousVersionId: null,
      editors: [{ auditScope }]
    } as any);

    let [events] = recordEvents.mock.calls[0]!;
    expect(events[0].payload).not.toHaveProperty('content');
    expect(events[0].payload.versionId).toBe('dver_4');
  });

  it('records nothing for a version nobody edited', async () => {
    await recordDocumentVersionSealed({
      document: { id: 'doc_1', title: 'Design notes' },
      version: { id: 'dver_4', versionNumber: 4, byteSize: 0, editedAt: new Date() },
      previousVersionId: null,
      editors: []
    } as any);

    expect(recordEvents).not.toHaveBeenCalled();
  });

  it('does not defer sealing behind a transaction hook, having none to wait for', async () => {
    await recordDocumentVersionSealed({
      document: { id: 'doc_1', title: 'Design notes' },
      version: { id: 'dver_4', versionNumber: 4, byteSize: 1, editedAt: new Date() },
      previousVersionId: null,
      editors: [{ auditScope }]
    } as any);

    expect(addAfterTransactionHook).not.toHaveBeenCalled();
    expect(recordEvents).toHaveBeenCalledTimes(1);
  });
});
