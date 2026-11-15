import { uniqueId } from '@lowerdeck/testing-tools';
import { describe, expect, it } from 'vitest';
import { voyager } from './client';
import {
  createSourceWithIndex,
  expectSearchToFind,
  indexRecord,
  uniqueWord
} from './fixtures';

let setup = async () => {
  let { source, index } = await createSourceWithIndex();
  return { source, index, target: { sourceId: source.id, indexId: index.id } };
};

describe('voyager record delete', () => {
  it('removes deleted documents from search and keeps the others', async () => {
    let { target } = await setup();
    let word = uniqueWord();

    let doomed = await indexRecord(target, { body: word });
    let survivor = await indexRecord(target, { body: word });
    await expectSearchToFind(target, word, [doomed.documentId, survivor.documentId]);

    let result = await voyager.record.delete({ ...target, documentIds: [doomed.documentId] });
    expect(result).toEqual({ success: true });

    await expectSearchToFind(target, word, [survivor.documentId]);
  });

  it('deletes several documents at once', async () => {
    let { target } = await setup();
    let word = uniqueWord();

    let a = await indexRecord(target, { body: word });
    let b = await indexRecord(target, { body: word });
    await expectSearchToFind(target, word, [a.documentId, b.documentId]);

    await voyager.record.delete({ ...target, documentIds: [a.documentId, b.documentId] });

    await expectSearchToFind(target, word, []);
  });

  it('succeeds for unknown document ids and empty lists', async () => {
    let { target } = await setup();
    let word = uniqueWord();
    let record = await indexRecord(target, { body: word });
    await expectSearchToFind(target, word, [record.documentId]);

    expect(
      await voyager.record.delete({ ...target, documentIds: [uniqueId('missing')] })
    ).toEqual({ success: true });
    expect(await voyager.record.delete({ ...target, documentIds: [] })).toEqual({
      success: true
    });

    await expectSearchToFind(target, word, [record.documentId]);
  });

  it('only deletes within the given index', async () => {
    let { target: first } = await setup();
    let { target: second } = await setup();
    let word = uniqueWord();

    let inFirst = await indexRecord(first, { body: word });
    let inSecond = await indexRecord(second, { body: word });
    await expectSearchToFind(first, word, [inFirst.documentId]);
    await expectSearchToFind(second, word, [inSecond.documentId]);

    await voyager.record.delete({ ...second, documentIds: [inFirst.documentId] });

    await expectSearchToFind(first, word, [inFirst.documentId]);
    await expectSearchToFind(second, word, [inSecond.documentId]);
  });

  it('allows indexing a document again after deleting it', async () => {
    let { target } = await setup();
    let word = uniqueWord();
    let documentId = uniqueId('doc');

    await indexRecord(target, { documentId, body: word });
    await expectSearchToFind(target, word, [documentId]);
    await voyager.record.delete({ ...target, documentIds: [documentId] });
    await expectSearchToFind(target, word, []);

    await indexRecord(target, { documentId, body: word });
    await expectSearchToFind(target, word, [documentId]);
  });

  it('rejects invalid input and unknown indexes', async () => {
    let { target } = await setup();

    await expect(voyager.record.delete({ ...target } as any)).rejects.toThrow();
    await expect(
      voyager.record.delete({ ...target, indexId: uniqueId('missing'), documentIds: ['x'] })
    ).rejects.toThrow();
  });
});
