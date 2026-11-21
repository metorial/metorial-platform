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

let storedLinks = async (fixture: Fixture) => ({
  organization: await db.agentTrackingOrganizationLink.findUnique({
    where: { organizationOid: fixture.organization.oid }
  }),
  project: await db.agentTrackingProjectLink.findUnique({
    where: { projectOid: fixture.project.oid }
  }),
  instance: await db.agentTrackingInstanceLink.findUnique({
    where: { instanceOid: fixture.instance.oid }
  })
});

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

    let serviceInstanceId = await withInstanceScope(fixture, async id => id);

    let links = await storedLinks(fixture);
    expect(links.instance?.serviceInstanceId).toBe(serviceInstanceId);
    expect((await trackedInstance(org.ids)).id).toBe(serviceInstanceId);
    expect((await trackedProject(org.ids)).id).toBe(links.project?.serviceProjectId);
    expect((await trackedOrganization(org.ids)).id).toBe(
      links.organization?.serviceOrganizationId
    );

    let renamed = uniqueId('Renamed Instance');
    expect(
      await withInstanceScope(
        { ...fixture, instance: { ...fixture.instance, name: renamed } },
        async id => id
      )
    ).toBe(serviceInstanceId);
    expect((await trackedInstance(org.ids)).name).not.toBe(renamed);
  });

  it('pushes the names Metorial holds to every level and keeps the links', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let names = {
      organization: uniqueId('Renamed Organization'),
      project: uniqueId('Renamed Project'),
      instance: uniqueId('Renamed Instance')
    };
    await db.agentTrackingOrganizationLink.deleteMany({
      where: { organizationOid: fixture.organization.oid }
    });
    await db.agentTrackingProjectLink.deleteMany({
      where: { projectOid: fixture.project.oid }
    });

    let scope = await pushInstanceScope({
      agentTracking: requireAgentTracking(),
      organization: { ...fixture.organization, name: names.organization },
      project: { ...fixture.project, name: names.project },
      instance: { ...fixture.instance, name: names.instance }
    });

    expect(await trackedInstance(org.ids)).toMatchObject({
      id: scope.id,
      name: names.instance
    });
    expect(await trackedOrganization(org.ids)).toMatchObject({ name: names.organization });
    expect(await trackedProject(org.ids)).toMatchObject({ name: names.project });

    let links = await storedLinks(fixture);
    expect(links.instance?.serviceInstanceId).toBe(scope.id);
    expect(links.project).not.toBeNull();
    expect(links.organization).not.toBeNull();
  });

  it('relinks an instance the service archived and repeats the call once', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let serviceInstanceId = await withInstanceScope(fixture, async id => id);
    await agentTracking().instance.archive({
      organizationId: org.ids.organizationId,
      instanceId: serviceInstanceId
    });

    let attempts = 0;
    let remote = await withInstanceScope(fixture, async instanceId => {
      attempts++;

      return await agentTracking().instance.get({
        organizationId: org.ids.organizationId,
        instanceId
      });
    });

    expect(attempts).toBe(2);
    expect(remote.archivedAt).toBeNull();
    expect((await storedLinks(fixture)).instance?.serviceInstanceId).toBe(remote.id);
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
