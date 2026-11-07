import { uniqueId } from '@lowerdeck/testing-tools';
import { describe, expect, it } from 'vitest';
import { db } from '../src/db';
import { voyager } from './client';
import { createIndex, createSource } from './fixtures';

describe('voyager index', () => {
  it('creates an index under a source and persists it', async () => {
    let source = await createSource();
    let identifier = uniqueId('index');

    let index = await voyager.index.upsert({
      sourceId: source.id,
      identifier,
      name: 'My Index'
    });
    expect(index).toMatchObject({
      object: 'voyager#index',
      identifier,
      name: 'My Index',
      source: { id: source.id, identifier: source.identifier }
    });
    expect(index.id).toMatch(/^vix_/);

    let row = await db.index.findUniqueOrThrow({
      where: { id: index.id },
      include: { source: true }
    });
    expect(row).toMatchObject({ identifier, name: 'My Index' });
    expect(row.source.id).toBe(source.id);
  });

  it('updates only the name when upserting the same identifier', async () => {
    let source = await createSource();
    let created = await createIndex(source.id, {
      identifier: uniqueId('index'),
      name: 'Before'
    });

    let updated = await voyager.index.upsert({
      sourceId: source.id,
      identifier: created.identifier,
      name: 'After'
    });
    expect(updated).toMatchObject({ id: created.id, name: 'After' });

    let rows = await db.index.findMany({ where: { identifier: created.identifier } });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.name).toBe('After');
  });

  it('scopes index identifiers to their source', async () => {
    let identifier = uniqueId('shared');
    let sourceA = await createSource();
    let sourceB = await createSource();

    let a = await createIndex(sourceA.id, { identifier });
    let b = await createIndex(sourceB.id, { identifier });

    expect(a.id).not.toBe(b.id);
    expect(a.source.id).toBe(sourceA.id);
    expect(b.source.id).toBe(sourceB.id);
  });

  it('gets an index by id and by identifier', async () => {
    let source = await createSource();
    let created = await createIndex(source.id);

    expect(
      await voyager.index.get({ sourceId: source.id, indexId: created.id })
    ).toMatchObject({ id: created.id });
    expect(
      await voyager.index.get({ sourceId: source.id, indexId: created.identifier })
    ).toMatchObject({ id: created.id });
  });

  it('does not expose an index through a different source', async () => {
    let owner = await createSource();
    let other = await createSource();
    let index = await createIndex(owner.id);

    await expect(
      voyager.index.get({ sourceId: other.id, indexId: index.id })
    ).rejects.toThrow();
    await expect(
      voyager.index.get({ sourceId: other.id, indexId: index.identifier })
    ).rejects.toThrow();
  });

  it('rejects unknown sources and indexes', async () => {
    let source = await createSource();

    await expect(
      voyager.index.upsert({
        sourceId: uniqueId('missing'),
        identifier: uniqueId('index'),
        name: 'Orphan'
      })
    ).rejects.toThrow();
    await expect(
      voyager.index.get({ sourceId: source.id, indexId: uniqueId('missing') })
    ).rejects.toThrow();
  });

  it('rejects invalid input', async () => {
    let source = await createSource();

    await expect(
      voyager.index.upsert({ sourceId: source.id, identifier: uniqueId('index') } as any)
    ).rejects.toThrow();
    await expect(voyager.index.get({ sourceId: source.id } as any)).rejects.toThrow();
  });
});
