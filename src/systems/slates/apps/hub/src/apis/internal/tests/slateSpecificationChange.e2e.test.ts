import { describe, it, expect, beforeEach } from 'vitest';
import { SlateSpecificationChangeType } from '../../../../prisma/generated/client';
import { testDb, cleanDatabase } from '../../../test/setup';
import { fixtures } from '../../../test/fixtures';
import { slatesHubClient } from '../../../test/client';

describe('slateSpecificationChange:list E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns specification changes', async () => {
    const { change, fromVersion, toVersion } =
      await f.slateSpecificationChange.withVersions();

    await f.slateSpecificationChange.withVersions();

    const result = await slatesHubClient.slateSpecificationChange.list({
      limit: 10
    });

    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      object: 'slate.specification_change',
      id: change.id,
      type: SlateSpecificationChangeType.between_versions,
      fromVersionId: fromVersion.id,
      toVersionId: toVersion.id,
      createdAt: expect.any(Date)
    });
  });

  it('filters by slateIds', async () => {
    const { change, slate } = await f.slateSpecificationChange.withVersions({
      slateIdentifier: 'slate-1'
    });
    await f.slateSpecificationChange.withVersions({ slateIdentifier: 'slate-2' });

    const result = await slatesHubClient.slateSpecificationChange.list({
      slateIds: [slate.id],
      limit: 10
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.id).toBe(change.id);
  });

  it('filters by versionIds', async () => {
    const { change, fromVersion } = await f.slateSpecificationChange.withVersions();

    const result = await slatesHubClient.slateSpecificationChange.list({
      versionIds: [fromVersion.id],
      limit: 10
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.id).toBe(change.id);
  });
});

describe('slateSpecificationChange:get E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns a single specification change by ID', async () => {
    const { change } = await f.slateSpecificationChange.withVersions();

    const result = await slatesHubClient.slateSpecificationChange.get({
      slateSpecificationChangeId: change.id
    });

    expect(result).toMatchObject({
      object: 'slate.specification_change',
      id: change.id,
      type: SlateSpecificationChangeType.between_versions
    });
  });
});

describe('slateSpecificationChange:getMany E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns multiple specification changes by IDs', async () => {
    const { change: change1 } = await f.slateSpecificationChange.withVersions();
    const { change: change2 } = await f.slateSpecificationChange.withVersions();

    const result = await slatesHubClient.slateSpecificationChange.getMany({
      slateSpecificationChangeIds: [change1.id, change2.id]
    });

    expect(result).toMatchObject([{ id: change1.id }, { id: change2.id }]);
  });
});
