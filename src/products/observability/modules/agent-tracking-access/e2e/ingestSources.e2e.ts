import {
  eventually,
  expectServiceError,
  firstPage,
  uniqueEmail,
  uniqueId,
  useOrganization
} from '@metorial/e2e';
import {
  agentTracking,
  claudeRequest,
  expectIngested,
  sendClaudeCodeRequests,
  trackedConsumer
} from '@metorial/agent-tracking-e2e';
import { db, loadOrganizationFixture, type OrganizationFixture } from '@metorial/e2e/db';
import {
  consumerProfileService,
  consumerSurfaceService
} from '@metorial/module-consumer-core';
import { describe, expect, it } from 'vitest';
import { agentTrackingIngestSourceService } from '../src';

let createIngestSource = async (fixture: OrganizationFixture, name = uniqueId('Laptops')) =>
  await agentTrackingIngestSourceService.createIngestSource({
    organization: fixture.organization,
    project: fixture.project,
    instance: fixture.instance,
    auditScope: fixture.auditScope,
    input: { name, clientFamily: 'claude_code' }
  });

let revoke = async (
  fixture: OrganizationFixture,
  ingestSource: Awaited<ReturnType<typeof createIngestSource>>['ingestSource']
) =>
  await agentTrackingIngestSourceService.revokeIngestSource({
    ingestSource,
    auditScope: fixture.auditScope
  });

let listedIds = async (fixture: OrganizationFixture, statuses?: ('active' | 'revoked')[]) =>
  (
    await firstPage(
      await agentTrackingIngestSourceService.listIngestSources({
        instance: fixture.instance,
        statuses
      })
    )
  ).map(item => item.ingestSource.id);

let waitForServiceRevoke = (ingestSourceId: string) =>
  eventually(
    async () => {
      let row = await db.agentTrackingIngestSource.findUniqueOrThrow({
        where: { id: ingestSourceId }
      });
      expect(row.serviceRevokedAt).not.toBeNull();
    },
    { timeoutMs: 30_000, intervalMs: 500 }
  );

let serialized = (value: unknown) =>
  JSON.stringify(value, (_, item) => (typeof item == 'bigint' ? `${item}` : item));

describe('module-agent-tracking-access ingestion keys', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  it('creates a key whose secret is returned once and stored nowhere', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let name = uniqueId('Engineering laptops');

    let created = await createIngestSource(fixture, name);
    expect(created).toMatchObject({ lastUsedAt: null, lastUsedStatus: 'never_used' });
    expect(created.secret.startsWith('metorial_agis_')).toBe(true);
    expect(typeof created.ingestUrl).toBe('string');

    let row = await db.agentTrackingIngestSource.findUniqueOrThrow({
      where: { id: created.ingestSource.id },
      include: { instance: true }
    });
    expect(row).toMatchObject({ status: 'active', name, clientFamily: 'claude_code' });
    expect(row.instance.id).toBe(org.ids.instanceId);
    expect(row.secretRedacted.endsWith(created.secret.slice(-4))).toBe(true);
    expect(serialized(row)).not.toContain(created.secret);

    let described = await agentTrackingIngestSourceService.describeIngestSource({
      ingestSource: await agentTrackingIngestSourceService.getIngestSourceById({
        instance: fixture.instance,
        ingestSourceId: created.ingestSource.id
      })
    });
    expect(described).toMatchObject({ secret: null, lastUsedStatus: 'never_used' });
    expect(await listedIds(fixture)).toContain(created.ingestSource.id);
  });

  it('revokes a key once, in Metorial first and then in the service', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let created = await createIngestSource(fixture);

    let revoked = await revoke(fixture, created.ingestSource);
    expect(revoked).toMatchObject({ secret: null, ingestSource: { status: 'revoked' } });
    expect(revoked.ingestSource.revokedAt).toBeInstanceOf(Date);

    let again = await revoke(fixture, created.ingestSource);
    expect(again.ingestSource.revokedAt).toEqual(revoked.ingestSource.revokedAt);

    expect(await listedIds(fixture)).not.toContain(created.ingestSource.id);
    expect(await listedIds(fixture, ['revoked'])).toContain(created.ingestSource.id);

    await waitForServiceRevoke(created.ingestSource.id);
  });

  it('accepts usage with a new key and refuses it once the key is revoked', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let created = await createIngestSource(fixture);
    let send = () =>
      sendClaudeCodeRequests({ ingestUrl: created.ingestUrl, secret: created.secret }, [
        claudeRequest()
      ]);

    await expectIngested(await send());

    await eventually(
      async () => {
        let described = await agentTrackingIngestSourceService.describeIngestSource({
          ingestSource: created.ingestSource
        });
        expect(described.lastUsedStatus).toBe('used');
        expect(described.lastUsedAt).toBeInstanceOf(Date);
      },
      { timeoutMs: 30_000, intervalMs: 500 }
    );

    await revoke(fixture, created.ingestSource);
    await waitForServiceRevoke(created.ingestSource.id);

    await eventually(async () => expect((await send()).status).toBe(401), {
      timeoutMs: 30_000,
      intervalMs: 1_000
    });
  }, 120_000);

  it('keeps keys to their instance', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let other = await loadOrganizationFixture(otherOrg.ids);
    let created = await createIngestSource(fixture);

    await expectServiceError(
      agentTrackingIngestSourceService.getIngestSourceById({
        instance: other.instance,
        ingestSourceId: created.ingestSource.id
      }),
      'not_found'
    );
    expect(await listedIds(other)).not.toContain(created.ingestSource.id);
    expect(await listedIds(other, ['active', 'revoked'])).not.toContain(
      created.ingestSource.id
    );
  });
});

describe('module-agent-tracking-access first ingestion key', () => {
  let org = useOrganization();

  it('backfills the members who existed before the first key', async () => {
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

    await createIngestSource(fixture);

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
