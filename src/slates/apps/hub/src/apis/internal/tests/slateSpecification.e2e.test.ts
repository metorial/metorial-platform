import { beforeEach, describe, expect, it } from 'vitest';
import { SlateStatus } from '../../../../prisma/generated/client';
import { getId } from '../../../id';
import { slatesHubClient } from '../../../test/client';
import { fixtures } from '../../../test/fixtures';
import { cleanDatabase, testDb } from '../../../test/setup';

describe('slateSpecification:list E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns specifications', async () => {
    const slate = await f.slate.complete({
      slateStatus: SlateStatus.active
    });

    await f.slate.complete();

    const result = await slatesHubClient.slateSpecification.list({
      limit: 10
    });

    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      id: slate.currentVersion.specification.id,
      protocolVersion: '1.0'
    });
  });

  it('filters by slateIds', async () => {
    const slate1 = await f.slate.complete({ slateIdentifier: 'slate-1' });
    await f.slate.complete({ slateIdentifier: 'slate-2' });

    const result = await slatesHubClient.slateSpecification.list({
      slateIds: [slate1.id],
      limit: 10
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.id).toBe(slate1.currentVersion.specification.id);
    expect(result.items[0]!.protocolVersion).toBe('1.0');
  });

  it('filters by versionIds', async () => {
    const slate = await f.slate.complete();

    const result = await slatesHubClient.slateSpecification.list({
      versionIds: [slate.currentVersion.id],
      limit: 10
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.id).toBe(slate.currentVersion.specification.id);
    expect(result.items[0]!.protocolVersion).toBe('1.0');
  });
});

describe('slateSpecification:get E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns a single specification by ID', async () => {
    const slate = await f.slate.complete({
      slateStatus: SlateStatus.active
    });

    const result = await slatesHubClient.slateSpecification.get({
      slateSpecificationId: slate.currentVersion.specification.id
    });

    expect(result).toMatchObject({
      id: slate.currentVersion.specification.id,
      protocolVersion: '1.0'
    });
  });

  it('includes the adapter for adapter actions', async () => {
    const slate = await f.slate.complete({ slateStatus: SlateStatus.active });
    const adapter = await testDb.adapter.create({
      data: {
        ...getId('adapter'),
        identifier: 'github',
        name: 'GitHub'
      }
    });
    const slateAdapter = await testDb.slateAdapter.create({
      data: {
        ...getId('slateAdapter'),
        identifier: `slate::${slate.id}::adapter::github`,
        slateOid: slate.oid,
        adapterOid: adapter.oid
      }
    });
    const action = await f.slateSpecification.createAction({
      slateOid: slate.oid,
      specificationOid: slate.currentVersion.specification.oid,
      overrides: { slateAdapterOid: slateAdapter.oid }
    });
    await f.slateSpecification.linkAction({
      specificationOid: slate.currentVersion.specification.oid,
      actionOid: action.oid
    });

    const result = await slatesHubClient.slateSpecification.get({
      slateSpecificationId: slate.currentVersion.specification.id
    });

    expect(result.tools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          adapter: expect.objectContaining({
            id: adapter.id,
            identifier: adapter.identifier,
            slateIdentifier: slateAdapter.identifier,
            name: 'GitHub'
          })
        })
      ])
    );
  });
});

describe('slateSpecification:getMany E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns multiple specifications by IDs', async () => {
    const slate1 = await f.slate.complete();
    const slate2 = await f.slate.complete();

    const result = await slatesHubClient.slateSpecification.getMany({
      slateSpecificationIds: [
        slate1.currentVersion.specification.id,
        slate2.currentVersion.specification.id
      ]
    });

    expect(result).toMatchObject([
      { id: slate1.currentVersion.specification.id, protocolVersion: '1.0' },
      { id: slate2.currentVersion.specification.id, protocolVersion: '1.0' }
    ]);
  });
});
