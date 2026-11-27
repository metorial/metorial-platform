import { listAll } from './helpers';
import { uniqueId } from '@lowerdeck/testing-tools';
import { describe, expect, it } from 'vitest';
import { SlateStatus } from '../prisma/generated/client';
import { getId } from '../src/id';
import { slatesHubClient } from './client';
import { fixtures } from './fixtures';
import { db as testDb } from '../src/db';

describe('slateSpecification:list E2E', () => {
  const f = fixtures(testDb);

  it('returns specifications', async () => {
    const slate = await f.slate.complete({
      slateStatus: SlateStatus.active
    });

    await f.slate.complete();

    const items = await listAll(page => slatesHubClient.slateSpecification.list(page));

    expect(items.find(i => i.id == slate.currentVersion.specification.id)).toMatchObject({
      id: slate.currentVersion.specification.id,
      protocolVersion: '1.0'
    });
  });

  it('filters by slateIds', async () => {
    const slate1 = await f.slate.complete({ slateIdentifier: uniqueId('slate') });
    await f.slate.complete({ slateIdentifier: uniqueId('slate') });

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
        identifier: uniqueId('github'),
        name: 'GitHub'
      }
    });
    const slateAdapter = await testDb.slateAdapter.create({
      data: {
        ...getId('slateAdapter'),
        identifier: `slate::${slate.id}::adapter::${uniqueId('github')}`,
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

  it('returns multiple specifications by IDs', async () => {
    let slate1 = await f.slate.complete();
    let slate2 = await f.slate.complete();

    let result = await slatesHubClient.slateSpecification.getMany({
      slateSpecificationIds: [
        slate1.currentVersion.specification.id,
        slate2.currentVersion.specification.id
      ]
    });

    expect(result).toHaveLength(2);
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: slate1.currentVersion.specification.id,
          protocolVersion: '1.0'
        }),
        expect.objectContaining({
          id: slate2.currentVersion.specification.id,
          protocolVersion: '1.0'
        })
      ])
    );
  });
});
