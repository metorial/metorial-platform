import { uniqueId } from '@lowerdeck/testing-tools';
import { describe, expect, it } from 'vitest';
import { db } from '../src/db';
import { voyager } from './client';

describe('voyager source', () => {
  it('creates a source and persists it', async () => {
    let identifier = uniqueId('source');

    let source = await voyager.source.upsert({ identifier, name: 'My Source' });
    expect(source).toMatchObject({
      object: 'voyager#source',
      identifier,
      name: 'My Source'
    });
    expect(source.id).toMatch(/^vsn_/);

    let row = await db.source.findUniqueOrThrow({ where: { identifier } });
    expect(row).toMatchObject({ id: source.id, name: 'My Source' });
  });

  it('updates the name when upserting the same identifier', async () => {
    let identifier = uniqueId('source');
    let created = await voyager.source.upsert({ identifier, name: 'Before' });

    let updated = await voyager.source.upsert({ identifier, name: 'After' });
    expect(updated).toMatchObject({ id: created.id, name: 'After' });

    let rows = await db.source.findMany({ where: { identifier } });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.name).toBe('After');
  });

  it('gets a source by id and by identifier', async () => {
    let identifier = uniqueId('source');
    let created = await voyager.source.upsert({ identifier, name: 'Fetch Me' });

    expect(await voyager.source.get({ sourceId: created.id })).toMatchObject({
      id: created.id,
      identifier
    });
    expect(await voyager.source.get({ sourceId: identifier })).toMatchObject({
      id: created.id,
      identifier
    });
  });

  it('rejects an unknown source', async () => {
    await expect(voyager.source.get({ sourceId: uniqueId('missing') })).rejects.toThrow();
  });

  it('rejects invalid input', async () => {
    await expect(
      voyager.source.upsert({ identifier: uniqueId('source') } as any)
    ).rejects.toThrow();
    await expect(voyager.source.upsert({ name: 'No Identifier' } as any)).rejects.toThrow();
    await expect(voyager.source.get({} as any)).rejects.toThrow();
  });
});
