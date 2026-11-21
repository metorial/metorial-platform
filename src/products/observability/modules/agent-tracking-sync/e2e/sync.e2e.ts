import { eventually, uniqueEmail, uniqueId, useOrganization } from '@metorial/e2e';
import {
  agentTracking,
  trackedConsumer,
  trackedInstance,
  trackedOrganization
} from '@metorial/agent-tracking-e2e';
import { db, loadOrganizationFixture } from '@metorial/e2e/db';
import {
  consumerProfileService,
  consumerSurfaceService
} from '@metorial/module-consumer-core';
import { describe, expect, it } from 'vitest';
import { agentTrackingSyncService, requireAgentTracking, withInstanceScope } from '../src';
import { pushInstanceScope } from '../src/lib/scope';

type Fixture = Awaited<ReturnType<typeof loadOrganizationFixture>>;

let storedLinks = async (fixture: Fixture) => {
  let select = { agentTrackingLinkedAt: true };
  let [organization, project, instance] = await Promise.all([
    db.organization.findUniqueOrThrow({ where: { oid: fixture.organization.oid }, select }),
    db.project.findUniqueOrThrow({ where: { oid: fixture.project.oid }, select }),
    db.instance.findUniqueOrThrow({ where: { oid: fixture.instance.oid }, select })
  ]);

  return {
    organization: organization.agentTrackingLinkedAt,
    project: project.agentTrackingLinkedAt,
    instance: instance.agentTrackingLinkedAt
  };
};

let trackedProject = (ids: { organizationId: string; projectId: string }) =>
  agentTracking().project.get({
    organizationId: ids.organizationId,
    projectId: ids.projectId
  });

describe('module-agent-tracking-sync scope and entities', () => {
  let org = useOrganization();

  it('creates an instance in the service on its first use only, then leaves it alone', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    await expect(trackedInstance(org.ids)).rejects.toMatchObject({ data: { status: 404 } });
    expect((await storedLinks(fixture)).instance).toBeNull();

    await withInstanceScope(fixture, async () => {});

    let links = await storedLinks(fixture);
    expect(links).toEqual({
      organization: expect.any(Date),
      project: expect.any(Date),
      instance: expect.any(Date)
    });
    expect((await trackedInstance(org.ids)).id).toBe(fixture.instance.id);
    expect((await trackedProject(org.ids)).id).toBe(fixture.project.id);
    expect((await trackedOrganization(org.ids)).id).toBe(fixture.organization.id);

    let renamed = uniqueId('Renamed Instance');
    await withInstanceScope(
      { ...fixture, instance: { ...fixture.instance, name: renamed } },
      async () => {}
    );
    expect((await trackedInstance(org.ids)).name).not.toBe(renamed);
    expect(await storedLinks(fixture)).toEqual(links);
  });

  it('pushes the names Metorial holds to every level and keeps the links', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let names = {
      organization: uniqueId('Renamed Organization'),
      project: uniqueId('Renamed Project'),
      instance: uniqueId('Renamed Instance')
    };
    await db.organization.update({
      where: { oid: fixture.organization.oid },
      data: { agentTrackingLinkedAt: null }
    });
    await db.project.update({
      where: { oid: fixture.project.oid },
      data: { agentTrackingLinkedAt: null }
    });

    await pushInstanceScope({
      agentTracking: requireAgentTracking(),
      organization: { ...fixture.organization, name: names.organization },
      project: { ...fixture.project, name: names.project },
      instance: { ...fixture.instance, name: names.instance }
    });

    expect(await trackedInstance(org.ids)).toMatchObject({
      id: fixture.instance.id,
      name: names.instance
    });
    expect(await trackedOrganization(org.ids)).toMatchObject({ name: names.organization });
    expect(await trackedProject(org.ids)).toMatchObject({ name: names.project });

    expect(await storedLinks(fixture)).toEqual({
      organization: expect.any(Date),
      project: expect.any(Date),
      instance: expect.any(Date)
    });
  });

  it('relinks an instance the service archived and repeats the call once', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    await withInstanceScope(fixture, async () => {});
    await agentTracking().instance.archive({
      organizationId: org.ids.organizationId,
      instanceId: fixture.instance.id
    });

    let attempts = 0;
    let remote = await withInstanceScope(fixture, async () => {
      attempts++;

      return await agentTracking().instance.get({
        organizationId: org.ids.organizationId,
        instanceId: fixture.instance.id
      });
    });

    expect(attempts).toBe(2);
    expect(remote).toMatchObject({ id: fixture.instance.id, archivedAt: null });
    expect((await storedLinks(fixture)).instance).toEqual(expect.any(Date));
  });

  it('syncs a new consumer and brings it back when the roster is backfilled', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let surface = await consumerSurfaceService.createConsumerSurface({
      organization: fixture.organization,
      instance: fixture.instance,
      context: fixture.context,
      auditScope: fixture.auditScope,
      type: 'portal',
      input: { name: uniqueId('Surface'), sessionExpiryTimeInSeconds: 3600 }
    });
    let profile = await consumerProfileService.createConsumerProfile({
      surface,
      email: uniqueEmail('agent-tracking-roster'),
      name: 'E2E Profile',
      auditScope: fixture.auditScope
    });
    let consumer = await db.consumer.findUniqueOrThrow({
      where: { oid: profile.consumerOid }
    });

    let synced = await eventually(() => trackedConsumer(org.ids, consumer.id), {
      timeoutMs: 60_000,
      intervalMs: 500
    });

    let archived = await agentTracking().entity.archive({
      organizationId: org.ids.organizationId,
      entityId: synced.id
    });
    expect(archived.status).toBe('archived');

    await agentTrackingSyncService.backfillRoster({ organization: fixture.organization });

    await eventually(
      async () => {
        let entity = await trackedConsumer(org.ids, consumer.id);
        expect(entity.id).toBe(synced.id);
        expect(entity.status).not.toBe('archived');
      },
      { timeoutMs: 90_000, intervalMs: 1_000 }
    );
  }, 180_000);
});
