import { describe, expect, it } from 'vitest';
import {
  createStoreItemAuditRecorder,
  toStoreItemAuditOperation
} from './storeItemAudit';

let item = (overrides: Record<string, unknown> = {}) => ({
  id: 'sti_1',
  kind: 'file' as const,
  path: '/notes.txt',
  file: { id: 'fil_1' },
  document: null,
  ...overrides
});

describe('toStoreItemAuditOperation', () => {
  it('summarises an item by reference, without its contents', () => {
    expect(toStoreItemAuditOperation('add', item())).toEqual({
      type: 'add',
      kind: 'file',
      path: '/notes.txt',
      itemId: 'sti_1',
      fileId: 'fil_1'
    });
  });

  it('links a document item to its document', () => {
    expect(
      toStoreItemAuditOperation('add', item({ kind: 'document', file: null, document: { id: 'doc_1' } }))
    ).toEqual({
      type: 'add',
      kind: 'document',
      path: '/notes.txt',
      itemId: 'sti_1',
      documentId: 'doc_1'
    });
  });

  it('records the previous path for a move', () => {
    expect(toStoreItemAuditOperation('modify', item(), '/old.txt')).toMatchObject({
      path: '/notes.txt',
      previousPath: '/old.txt'
    });
  });

  it('omits the previous path when it did not change', () => {
    expect(toStoreItemAuditOperation('modify', item(), '/notes.txt')).not.toHaveProperty(
      'previousPath'
    );
  });
});

describe('createStoreItemAuditRecorder', () => {
  it('counts every operation and lists them while under the cap', () => {
    let recorder = createStoreItemAuditRecorder(10);

    recorder.record('add', item({ id: 'sti_1' }));
    recorder.record('modify', item({ id: 'sti_2' }), '/old.txt');
    recorder.record('remove', item({ id: 'sti_3' }));

    expect(recorder.total).toBe(3);
    expect(recorder.summary.counts).toEqual({ add: 1, modify: 1, remove: 1 });
    expect(recorder.summary.operations).toHaveLength(3);
    expect(recorder.summary.truncated).toBe(false);
  });

  it('caps the listed operations but keeps counting past the cap', () => {
    let recorder = createStoreItemAuditRecorder(2);

    for (let index = 0; index < 120; index++) {
      recorder.record('add', item({ id: `sti_${index}` }));
    }

    expect(recorder.total).toBe(120);
    expect(recorder.summary.counts).toEqual({ add: 120, modify: 0, remove: 0 });
    expect(recorder.summary.operations).toHaveLength(2);
    expect(recorder.summary.truncated).toBe(true);
  });

  it('starts empty so a request that changes nothing records nothing', () => {
    let recorder = createStoreItemAuditRecorder();

    expect(recorder.total).toBe(0);
    expect(recorder.summary.operations).toEqual([]);
    expect(recorder.summary.truncated).toBe(false);
  });
});
