import { beforeEach, describe, expect, it } from 'vitest';
import { SlateEventType } from '../../../../prisma/generated/client';
import { slatesHubClient } from '../../../test/client';
import { fixtures } from '../../../test/fixtures';
import { cleanDatabase, testDb } from '../../../test/setup';

describe('slateEvent:list E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns events for a slate', async () => {
    const { event, slate } = await f.slateEvent.withSlate({
      type: SlateEventType.version_pulled
    });

    const laterEvent = await f.slateEvent.default({
      slateOid: slate.oid,
      slateVersionOid: slate.currentVersion.oid
    });

    const result = await slatesHubClient.slateEvent.list({
      slateId: slate.id,
      limit: 10
    });

    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      id: laterEvent.id,
      type: SlateEventType.version_pulled,
      message: expect.any(String),
      slate: {
        id: slate.id
      },
      version: {
        id: slate.currentVersion.id
      },
      deployment: null,
      discovery: null,
      createdAt: expect.any(Date)
    });
    expect(result.items[1]).toMatchObject({
      id: event.id,
      type: SlateEventType.version_pulled,
      message: expect.any(String),
      slate: {
        id: slate.id
      },
      version: {
        id: slate.currentVersion.id
      },
      deployment: null,
      discovery: null,
      createdAt: expect.any(Date)
    });
  });

  it('filters by versionIds', async () => {
    const slate = await f.slate.complete();
    const event = await f.slateEvent.default({
      slateOid: slate.oid,
      slateVersionOid: slate.currentVersion.oid,
      type: SlateEventType.deployment_started
    });

    const result = await slatesHubClient.slateEvent.list({
      slateId: slate.id,
      versionIds: [slate.currentVersion.id],
      limit: 10
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.id).toBe(event.id);
  });

  it('filters by type without slateId', async () => {
    const slate1 = await f.slate.complete();
    const slate2 = await f.slate.complete();

    const deploymentEvent = await f.slateEvent.default({
      slateOid: slate1.oid,
      slateVersionOid: slate1.currentVersion.oid,
      type: SlateEventType.deployment_started
    });

    await f.slateEvent.default({
      slateOid: slate2.oid,
      slateVersionOid: slate2.currentVersion.oid,
      type: SlateEventType.discovery_succeeded
    });

    const result = await slatesHubClient.slateEvent.list({
      type: SlateEventType.deployment_started,
      limit: 10
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.id).toBe(deploymentEvent.id);
  });
});

describe('slateEvent:get E2E', () => {
  const f = fixtures(testDb);

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('returns a single event by ID', async () => {
    const { event, slate } = await f.slateEvent.withSlate({
      type: SlateEventType.discovery_succeeded
    });

    const result = await slatesHubClient.slateEvent.get({
      slateId: slate.id,
      slateEventId: event.id
    });

    expect(result).toMatchObject({
      id: event.id,
      type: SlateEventType.discovery_succeeded,
      slate: {
        id: slate.id
      },
      version: {
        id: slate.currentVersion.id
      }
    });
  });

  it('includes deployment and discovery when present', async () => {
    const slate = await f.slate.complete();
    const provider = await f.deploymentProvider.default();

    const deployment = await f.slateDeployment.succeeded({
      slateOid: slate.oid,
      slateVersionOid: slate.currentVersion.oid,
      providerOid: provider.oid
    });

    const discovery = await f.slateVersionDiscovery.default({
      slateVersionOid: slate.currentVersion.oid,
      specificationOid: slate.currentVersion.specification.oid
    });

    const event = await f.slateEvent.default({
      slateOid: slate.oid,
      slateVersionOid: slate.currentVersion.oid,
      type: SlateEventType.deployment_started
    });

    const result = await slatesHubClient.slateEvent.get({
      slateId: slate.id,
      slateEventId: event.id
    });

    expect(result).toMatchObject({
      id: event.id,
      deployment: { id: deployment.id },
      discovery: { id: discovery.id }
    });
  });
});
