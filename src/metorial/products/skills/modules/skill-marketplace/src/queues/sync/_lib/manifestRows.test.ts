import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = {
  oid: bigint;
  destinationOid: bigint;
  path: string;
  itemKey: string | null;
  [key: string]: unknown;
};

let { table, db } = vi.hoisted(() => {
  let table = { rows: [] as Row[], nextOid: 1n };

  let matches = (row: Row, where: any) =>
    row.destinationOid === where.destinationOid &&
    (where.itemKey === undefined || row.itemKey === where.itemKey) &&
    (where.path?.in === undefined || where.path.in.includes(row.path));

  let db = {
    skillDestinationFile: {
      findMany: vi.fn(async ({ where }: any) => table.rows.filter(row => matches(row, where))),
      deleteMany: vi.fn(async ({ where }: any) => {
        table.rows = table.rows.filter(row => !where.oid.in.includes(row.oid));
      }),
      createMany: vi.fn(async ({ data }: any) => {
        for (let row of data) table.rows.push({ oid: table.nextOid++, ...row });
      }),
      update: vi.fn(async ({ where, data }: any) => {
        let row = table.rows.find(row => row.oid === where.oid)!;
        Object.assign(row, data);
      })
    }
  };

  return { table, db };
});

vi.mock('@metorial/db', () => ({
  withTransaction: async (run: (tx: typeof db) => unknown) => run(db)
}));

import { replaceSkillDestinationItemRows, type ManifestRow } from './manifestRows';

let row = (path: string, sha = 'a'): ManifestRow => ({
  path,
  gitBlobSha: sha.repeat(40),
  sha256: sha.repeat(64),
  byteSize: 1n,
  crc32: 2n,
  sourceKind: 'blob',
  sourceKey: `skill-sync/blobs/sha256/${sha.repeat(64)}`,
  sourceFileOid: null
});

let replace = (itemKey: string, rows: ManifestRow[], live: string[] = []) =>
  replaceSkillDestinationItemRows({
    destinationOid: 1n,
    itemKey,
    rows,
    liveItemKeys: new Set([itemKey, ...live])
  });

let pathsOf = (itemKey: string) =>
  table.rows
    .filter(row => row.itemKey === itemKey)
    .map(row => row.path)
    .sort();

describe('replaceSkillDestinationItemRows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    table.rows = [];
    table.nextOid = 1n;
  });

  it('creates, updates, deletes and leaves unchanged rows alone', async () => {
    await replace('skill:a:p', [row('s/a.md'), row('s/b.md'), row('s/c.md')]);
    db.skillDestinationFile.update.mockClear();

    let result = await replace('skill:a:p', [
      row('s/a.md'),
      row('s/b.md', 'b'),
      row('s/d.md')
    ]);

    expect(result).toMatchObject({ created: 1, updated: 1, deleted: 1, unchanged: 1 });
    expect(pathsOf('skill:a:p')).toEqual(['s/a.md', 's/b.md', 's/d.md']);
    expect(table.rows.find(r => r.path === 's/b.md')).toMatchObject({
      signature: `git:${'b'.repeat(40)}`,
      sha256: 'b'.repeat(64)
    });
    expect(db.skillDestinationFile.update).toHaveBeenCalledOnce();
  });

  it('is a no-op for identical content', async () => {
    await replace('skill:a:p', [row('s/a.md')]);
    vi.clearAllMocks();

    let result = await replace('skill:a:p', [row('s/a.md')]);

    expect(result).toMatchObject({ created: 0, updated: 0, deleted: 0, unchanged: 1 });
    expect(db.skillDestinationFile.createMany).not.toHaveBeenCalled();
    expect(db.skillDestinationFile.deleteMany).not.toHaveBeenCalled();
  });

  it('resolves a path two live items write to the smaller item key in either order', async () => {
    let forward = async () => {
      await replace('plugin:p', [row('shared.json', 'p')], ['marketplace:m']);
      return await replace('marketplace:m', [row('shared.json', 'm')], ['plugin:p']);
    };
    let backward = async () => {
      await replace('marketplace:m', [row('shared.json', 'm')], ['plugin:p']);
      return await replace('plugin:p', [row('shared.json', 'p')], ['marketplace:m']);
    };

    await forward();
    let forwardRows = table.rows.map(({ oid, ...rest }) => rest);

    table.rows = [];
    let result = await backward();
    let backwardRows = table.rows.map(({ oid, ...rest }) => rest);

    expect(forwardRows).toEqual(backwardRows);
    expect(backwardRows).toEqual([
      expect.objectContaining({ path: 'shared.json', itemKey: 'marketplace:m' })
    ]);
    expect(result.conflicts).toEqual([{ path: 'shared.json', ownerItemKey: 'marketplace:m' }]);
  });

  it('takes over rows of items that are no longer live and legacy rows without an item', async () => {
    await replace('skill:old:p', [row('s/a.md')]);
    table.rows.push({ oid: 99n, destinationOid: 1n, path: 's/b.md', itemKey: null });

    let result = await replace('skill:new:p', [row('s/a.md'), row('s/b.md')]);

    expect(result.conflicts).toEqual([]);
    expect(pathsOf('skill:new:p')).toEqual(['s/a.md', 's/b.md']);
    expect(table.rows).toHaveLength(2);
  });

  it('keeps one row per path when the serializer wrote a path twice', async () => {
    await replace('skill:a:p', [row('s/a.md', 'a'), row('s/a.md', 'b')]);

    expect(table.rows).toEqual([expect.objectContaining({ sha256: 'b'.repeat(64) })]);
  });

  it('stores the UTF-8 bytes of the NFC path and fills them in on rows written without them', async () => {
    await replace('skill:a:p', [row('s/cafe\u0301.md')]);
    expect(table.rows[0]!.pathBytes).toEqual(new TextEncoder().encode('s/caf\u00e9.md'));

    table.rows[0]!.pathBytes = null;
    let result = await replace('skill:a:p', [row('s/cafe\u0301.md')]);

    expect(result).toMatchObject({ updated: 1, unchanged: 0 });
    expect(table.rows[0]!.pathBytes).toEqual(new TextEncoder().encode('s/caf\u00e9.md'));
  });
});
