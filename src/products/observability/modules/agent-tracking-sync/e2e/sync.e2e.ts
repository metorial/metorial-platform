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
import { agentTrackingSyncService } from '../src';

describe('module-agent-tracking-sync scope and entities', () => {
  let org = useOrganization();

  it('sends the names Metorial holds to the service scope of an instance', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let names = {
      organization: uniqueId('Renamed Organization'),
      project: uniqueId('Renamed Project'),
      instance: uniqueId('Renamed Instance')
    };

    let scope = await agentTrackingSyncService.upsertInstanceScope({
      organization: { ...fixture.organization, name: names.organization },
      project: { ...fixture.project, name: names.project },
      instance: { ...fixture.instance, name: names.instance }
    });

    expect(await trackedInstance(org.ids)).toMatchObject({
      id: scope.id,
      name: names.instance
    });
    expect(await trackedOrganization(org.ids)).toMatchObject({ name: names.organization });
    expect(
      await agentTracking().project.get({
        organizationId: org.ids.organizationId,
        projectId: org.ids.projectId
      })
    ).toMatchObject({ name: names.project });
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

    // Only a backfill brings an archived entity back, so archiving the one the live sync made
    // shows the backfill ran.
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
