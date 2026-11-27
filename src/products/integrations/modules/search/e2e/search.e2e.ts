import { eventually, uniqueId } from '@metorial/e2e';
import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { voyager, voyagerIndex, voyagerSource } from '../src';

describe('module-search', () => {
  it('registers the subspace source and its indexes in Voyager', async () => {
    let source = await voyagerSource;
    expect(source.id).toBeTruthy();
    expect(source.identifier).toMatch(/subspace$/);
    expect((await voyager.source.get({ sourceId: source.id })).id).toBe(source.id);

    let indexes = Object.values(voyagerIndex);
    expect(new Set(indexes.map(index => index.id)).size).toBe(indexes.length);
    for (let index of indexes) {
      expect(index.source.id).toBe(source.id);
      expect(index.identifier.startsWith(`${source.identifier}_`)).toBe(true);
    }

    let again = await voyager.index.upsert({
      sourceId: source.id,
      identifier: voyagerIndex.identity.identifier,
      name: voyagerIndex.identity.name
    });
    expect(again.id).toBe(voyagerIndex.identity.id);
  });

  it('indexes and searches tenant scoped records', async () => {
    let source = await voyagerSource;
    let tenantId = uniqueId('search-tenant');
    let documentId = uniqueId('search-doc');
    let term = `e2esearch${randomBytes(6).toString('hex')}`;

    await voyager.record.index({
      sourceId: source.id,
      indexId: voyagerIndex.identity.id,
      documentId,
      tenantIds: [tenantId],
      fields: { identityId: documentId },
      body: { name: term, description: 'E2E search record' }
    });

    try {
      let results = await eventually(
        async () => {
          let found = await voyager.record.search({
            tenantId,
            sourceId: source.id,
            indexId: voyagerIndex.identity.id,
            query: term
          });
          expect(found.map(record => record.documentId)).toContain(documentId);
          return found;
        },
        { timeoutMs: 30_000, intervalMs: 500 }
      );
      expect(results.find(record => record.documentId === documentId)?.isTenantSpecific).toBe(
        true
      );

      let otherTenant = await voyager.record.search({
        tenantId: uniqueId('other-tenant'),
        sourceId: source.id,
        indexId: voyagerIndex.identity.id,
        query: term
      });
      expect(otherTenant.map(record => record.documentId)).not.toContain(documentId);

      await voyager.record.delete({
        sourceId: source.id,
        indexId: voyagerIndex.identity.id,
        documentIds: [documentId]
      });

      await eventually(
        async () => {
          let afterDelete = await voyager.record.search({
            tenantId,
            sourceId: source.id,
            indexId: voyagerIndex.identity.id,
            query: term
          });
          expect(afterDelete.map(record => record.documentId)).not.toContain(documentId);
        },
        { timeoutMs: 30_000, intervalMs: 500 }
      );
    } finally {
      await voyager.record.delete({
        sourceId: source.id,
        indexId: voyagerIndex.identity.id,
        documentIds: [documentId]
      });
    }
  });
});
