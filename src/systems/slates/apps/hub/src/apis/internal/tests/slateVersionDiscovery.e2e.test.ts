import { beforeEach, describe, expect, it } from 'vitest';
import { SlateVersionDiscoveryStatus } from '../../../../prisma/generated/client';
import { slatesHubClient } from '../../../test/client';
import { fixtures } from '../../../test/fixtures';
import { cleanDatabase, testDb } from '../../../test/setup';

describe('slateVersionDiscovery:list E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns discoveries for a slate', async () => {
    const { discovery, slate } = await f.slateVersionDiscovery.withSlate({
      status: SlateVersionDiscoveryStatus.succeeded
    });

    await f.slateVersionDiscovery.default({
      slateVersionOid: slate.currentVersion.oid,
      specificationOid: slate.currentVersion.specification.oid
    });

    const result = await slatesHubClient.slateVersionDiscovery.list({
      slateId: slate.id,
      limit: 10
    });

    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      object: 'slate.version_discovery',
      id: discovery.id,
      slateVersionId: slate.currentVersion.id,
      specificationId: slate.currentVersion.specification.id,
      createdAt: expect.any(Date)
    });
  });

  it('filters by versionIds', async () => {
    const { discovery, slate } = await f.slateVersionDiscovery.withSlate();

    const result = await slatesHubClient.slateVersionDiscovery.list({
      slateId: slate.id,
      versionIds: [slate.currentVersion.id],
      limit: 10
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.id).toBe(discovery.id);
  });
});

describe('slateVersionDiscovery:get E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns a single discovery by ID', async () => {
    const { discovery, slate } = await f.slateVersionDiscovery.withSlate({
      status: SlateVersionDiscoveryStatus.succeeded
    });

    const result = await slatesHubClient.slateVersionDiscovery.get({
      slateId: slate.id,
      slateVersionDiscoveryId: discovery.id
    });

    expect(result).toMatchObject({
      id: discovery.id
    });
  });

  it('returns failed discovery with error message', async () => {
    const slate = await f.slate.complete();
    const discovery = await f.slateVersionDiscovery.failed({
      slateVersionOid: slate.currentVersion.oid,
      errorMessage: 'Something went wrong'
    });

    const result = await slatesHubClient.slateVersionDiscovery.get({
      slateId: slate.id,
      slateVersionDiscoveryId: discovery.id
    });

    expect(result).toMatchObject({
      id: discovery.id,
      error: {
        code: 'version_discovery_error',
        message: 'Something went wrong'
      }
    });
  });
});
