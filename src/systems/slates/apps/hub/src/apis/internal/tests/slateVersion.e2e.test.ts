import { describe, it, expect, beforeEach } from 'vitest';
import { SlateStatus } from '../../../../prisma/generated/client';
import { testDb, cleanDatabase } from '../../../test/setup';
import { fixtures } from '../../../test/fixtures';
import { slatesHubClient } from '../../../test/client';

describe('slateVersion:list E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns versions for a slate', async () => {
    const slate = await f.slate.complete({
      slateStatus: SlateStatus.active
    });

    await f.slateVersion.withSpecification({
      slateOid: slate.oid,
      registryOid: slate.registry.oid,
      version: '1.1.0'
    });

    const result = await slatesHubClient.slateVersion.list({
      slateId: slate.id,
      limit: 10
    });

    expect(result.items).toHaveLength(2);
    const [first, second] = result.items;
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    expect(first!.createdAt.getTime()).toBeGreaterThanOrEqual(
      second!.createdAt.getTime()
    );
    expect(result.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          object: 'slate.version',
          id: slate.currentVersion.id,
          version: '1.0.0'
        }),
        expect.objectContaining({
          object: 'slate.version',
          version: '1.1.0'
        })
      ])
    );
  });
});

describe('slateVersion:get E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns a single version by ID', async () => {
    const slate = await f.slate.complete({
      slateStatus: SlateStatus.active
    });

    const result = await slatesHubClient.slateVersion.get({
      slateId: slate.id,
      slateVersionId: slate.currentVersion.id
    });

    expect(result).toMatchObject({
      object: 'slate.version',
      id: slate.currentVersion.id,
      version: '1.0.0',
      slateId: slate.id
    });
  });
});

describe('slateVersion:getMany E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns multiple versions by IDs', async () => {
    const slate1 = await f.slate.complete();
    const slate2 = await f.slate.complete();

    const result = await slatesHubClient.slateVersion.getMany({
      slateVersionIds: [slate1.currentVersion.id, slate2.currentVersion.id]
    });

    expect(result).toMatchObject([
      { id: slate1.currentVersion.id },
      { id: slate2.currentVersion.id }
    ]);
  });
});
