import { beforeEach, describe, expect, it, vi } from 'vitest';

let { db, touchStore, markSync, state } = vi.hoisted(() => ({
  db: {
    file: { update: vi.fn() },
    document: { update: vi.fn() },
    skillAgent: { updateMany: vi.fn() }
  },
  touchStore: vi.fn(),
  markSync: vi.fn(),
  state: { title: 'Before', storeTouched: false, syncMarked: false }
}));

vi.mock('@lowerdeck/service', () => ({
  Service: { create: (_name: string, factory: () => unknown) => ({ build: factory }) }
}));
vi.mock('@metorial/db', () => ({
  withTransaction: async (run: (tx: typeof db) => unknown) => {
    let previous = { ...state };
    try {
      return await run(db);
    } catch (error) {
      Object.assign(state, previous);
      throw error;
    }
  }
}));
vi.mock('@metorial/module-store', () => ({
  storeVersionService: { touchStoresLastEditedAtForDocument: touchStore }
}));
vi.mock('../queues/lifecycle', () => ({ enqueueDocumentLifecycle: markSync }));
vi.mock('../services/document', () => ({ documentInclude: {} }));
vi.mock('./documentParticipant', () => ({ internalDocumentParticipantService: {} }));
vi.mock('./documentVersioning', () => ({ internalDocumentVersioningService: {} }));

import { internalDocumentContentService } from './documentContent';

let persist = () =>
  internalDocumentContentService.persistDraftToDocument({
    project: {} as never,
    instance: {} as never,
    document: {
      title: 'Before',
      content: { content: 'unchanged' },
      file: { id: 'file_1' }
    } as never,
    draft: { title: 'After', content: 'unchanged' } as never,
    actors: []
  });

describe('document sync intent persistence', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    Object.assign(state, { title: 'Before', storeTouched: false, syncMarked: false });
    db.document.update.mockImplementation(async () => {
      state.title = 'After';
      return { id: 'doc_1', oid: 1n };
    });
    touchStore.mockImplementation(async () => {
      state.storeTouched = true;
    });
    markSync.mockImplementation(async () => {
      state.syncMarked = true;
    });
  });

  it('commits the document, store hash input, and sync trigger together', async () => {
    await persist();

    expect(state).toEqual({ title: 'After', storeTouched: true, syncMarked: true });
    expect(markSync).toHaveBeenCalledWith({ documentId: 'doc_1', event: 'contents-changed' });
  });

  it('rolls back the document and store timestamp if recording sync intent fails', async () => {
    markSync.mockRejectedValueOnce(new Error('database unavailable'));

    await expect(persist()).rejects.toThrow('database unavailable');

    expect(state).toEqual({ title: 'Before', storeTouched: false, syncMarked: false });
  });
});
