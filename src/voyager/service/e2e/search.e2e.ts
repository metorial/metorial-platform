import { eventually, uniqueId } from '@lowerdeck/testing-tools';
import { describe, expect, it } from 'vitest';
import { voyager } from './client';
import {
  createSourceWithIndex,
  expectSearchToFind,
  indexRecord,
  searchDocumentIds,
  uniqueWord
} from './fixtures';

let setup = async (options: { indexIdentifier?: string } = {}) => {
  let { source, index } = await createSourceWithIndex(options);
  return { source, index, target: { sourceId: source.id, indexId: index.id } };
};

describe('voyager search', () => {
  it('finds records by words in a string body', async () => {
    let { target } = await setup();
    let word = uniqueWord();

    let match = await indexRecord(target, { body: `The ${word} is here` });
    await indexRecord(target, { body: 'nothing relevant at all' });

    await expectSearchToFind(target, word, [match.documentId]);
  });

  it('searches all values of an object body', async () => {
    let { target } = await setup();
    let first = uniqueWord();
    let second = uniqueWord();

    let match = await indexRecord(target, {
      body: { title: `About ${first}`, description: `Mentions ${second}` }
    });

    await expectSearchToFind(target, first, [match.documentId]);
    await expectSearchToFind(target, second, [match.documentId]);
  });

  it('ignores punctuation in the query', async () => {
    let { target } = await setup();
    let word = uniqueWord();

    let match = await indexRecord(target, { body: `Contains ${word} somewhere` });

    await expectSearchToFind(target, `"${word}"!!!`, [match.documentId]);
  });

  it('returns every visible record for an empty query', async () => {
    let { target } = await setup();

    let a = await indexRecord(target, { body: 'alpha' });
    let b = await indexRecord(target, { body: 'beta' });

    await expectSearchToFind(target, '', [a.documentId, b.documentId]);
  });

  it('narrows results with field filters', async () => {
    let { target } = await setup();
    let word = uniqueWord();

    let both = await indexRecord(target, {
      body: word,
      fields: { category: 'tools', status: 'live' }
    });
    let onlyCategory = await indexRecord(target, {
      body: word,
      fields: { category: 'tools', status: 'draft' }
    });
    let other = await indexRecord(target, { body: word, fields: { category: 'games' } });

    await expectSearchToFind(target, word, [
      both.documentId,
      onlyCategory.documentId,
      other.documentId
    ]);
    await expectSearchToFind(target, word, [both.documentId, onlyCategory.documentId], {
      filters: { category: 'tools' }
    });
    await expectSearchToFind(target, word, [both.documentId], {
      filters: { category: 'tools', status: 'live' }
    });
    await expectSearchToFind(target, word, [], { filters: { category: 'missing' } });
  });

  it('supports filtering on nested and array field values', async () => {
    let { target } = await setup();
    let word = uniqueWord();

    let match = await indexRecord(target, {
      body: word,
      fields: { labels: ['a', 'b'], owner: { team: 'core' } }
    });
    await indexRecord(target, { body: word, fields: { labels: ['c'], owner: { team: 'x' } } });

    await expectSearchToFind(target, word, [match.documentId], {
      filters: { owner: { team: 'core' } }
    });
    await expectSearchToFind(target, word, [match.documentId], { filters: { labels: ['a'] } });
  });

  it('only returns global records without a tenant', async () => {
    let { target } = await setup();
    let word = uniqueWord();
    let tenant = uniqueId('tenant');

    let global = await indexRecord(target, { body: word });
    await indexRecord(target, { body: word, tenantIds: [tenant] });

    await expectSearchToFind(target, word, [global.documentId]);
  });

  it('returns global and own records for a tenant but never other tenants records', async () => {
    let { target } = await setup();
    let word = uniqueWord();
    let tenantA = await voyager.tenant.upsert({ identifier: uniqueId('tenant') });
    let tenantB = await voyager.tenant.upsert({ identifier: uniqueId('tenant') });

    let global = await indexRecord(target, { body: word });
    let forA = await indexRecord(target, { body: word, tenantIds: [tenantA.id] });
    let forB = await indexRecord(target, { body: word, tenantIds: [tenantB.id] });
    let forBoth = await indexRecord(target, {
      body: word,
      tenantIds: [tenantA.id, tenantB.id]
    });

    await expectSearchToFind(
      target,
      word,
      [global.documentId, forA.documentId, forBoth.documentId],
      { tenantId: tenantA.id }
    );
    await expectSearchToFind(
      target,
      word,
      [global.documentId, forB.documentId, forBoth.documentId],
      { tenantId: tenantB.id }
    );
  });

  it('resolves the searching tenant by identifier and treats unknown tenants as none', async () => {
    let { target } = await setup();
    let word = uniqueWord();
    let identifier = uniqueId('tenant');

    let global = await indexRecord(target, { body: word });
    let own = await indexRecord(target, { body: word, tenantIds: [identifier] });

    await expectSearchToFind(target, word, [global.documentId, own.documentId], {
      tenantId: identifier
    });
    await expectSearchToFind(target, word, [global.documentId], {
      tenantId: uniqueId('unknown')
    });
  });

  it('keeps indexes isolated from each other', async () => {
    let { target: first } = await setup();
    let { target: second } = await setup();
    let word = uniqueWord();

    let inFirst = await indexRecord(first, { body: word });
    let inSecond = await indexRecord(second, { body: word });

    await expectSearchToFind(first, word, [inFirst.documentId]);
    await expectSearchToFind(second, word, [inSecond.documentId]);
  });

  it('does not search an index through a different source', async () => {
    let { target } = await setup();
    let { source: other } = await setup();

    await expect(
      voyager.record.search({ sourceId: other.id, indexId: target.indexId, query: 'x' })
    ).rejects.toThrow();
  });

  it('prefers title matches in provider listing indexes', async () => {
    let { target } = await setup({ indexIdentifier: 'subspace_provider_listing' });
    let word = uniqueWord();

    let titleMatch = await indexRecord(target, { body: `${word} Tools, general description` });
    await indexRecord(target, { body: `Other Thing, mentions ${word} in the description` });

    await expectSearchToFind(target, word, [titleMatch.documentId]);
  });

  it('falls back to body matches in provider listing indexes without a title match', async () => {
    let { target } = await setup({ indexIdentifier: 'subspace_provider_listing' });
    let word = uniqueWord();

    let bodyMatch = await indexRecord(target, { body: `Some Title, mentions ${word} here` });

    await expectSearchToFind(target, word, [bodyMatch.documentId]);
  });

  it('matches body words in regular indexes regardless of position', async () => {
    let { target } = await setup();
    let word = uniqueWord();

    let a = await indexRecord(target, { body: `${word} Tools, general description` });
    let b = await indexRecord(target, { body: `Other Thing, mentions ${word} later` });

    await expectSearchToFind(target, word, [a.documentId, b.documentId]);
  });

  it('reflects an updated body after re-indexing', async () => {
    let { target } = await setup();
    let before = uniqueWord();
    let after = uniqueWord();
    let documentId = uniqueId('doc');

    await indexRecord(target, { documentId, body: before });
    await expectSearchToFind(target, before, [documentId]);

    await indexRecord(target, { documentId, body: after });
    await expectSearchToFind(target, after, [documentId]);
    await expectSearchToFind(target, before, []);
  });

  it('returns presented records', async () => {
    let { target } = await setup();
    let word = uniqueWord();

    let record = await indexRecord(target, {
      body: word,
      fields: { a: 1 },
      metadata: { m: true }
    });
    await expectSearchToFind(target, word, [record.documentId]);

    let results = await voyager.record.search({ ...target, query: word });
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      object: 'voyager#record',
      id: record.id,
      documentId: record.documentId,
      fields: { a: 1 },
      metadata: { m: true }
    });
  });

  it('returns nothing for a query that matches nothing', async () => {
    let { target } = await setup();
    await indexRecord(target, { body: 'present' });

    expect(await searchDocumentIds(target, uniqueWord())).toEqual([]);
  });

  it('rejects invalid input', async () => {
    let { target } = await setup();

    await expect(voyager.record.search({ ...target } as any)).rejects.toThrow();
    await expect(
      voyager.record.search({ ...target, query: 'x', filters: 'nope' } as any)
    ).rejects.toThrow();
  });

  it.fails(
    'searches a document id that exists in two indexes in both (bug: search backend keys documents by documentId only)',
    async () => {
      let { target: first } = await setup();
      let { target: second } = await setup();
      let word = uniqueWord();
      let documentId = uniqueId('doc');

      await indexRecord(first, { documentId, body: word });
      await indexRecord(second, { documentId, body: word });

      await expectSearchToFind(first, word, [documentId]);
      await eventually(
        async () => expect(await searchDocumentIds(second, word)).toEqual([documentId]),
        { timeoutMs: 3000 }
      );
    }
  );
});
