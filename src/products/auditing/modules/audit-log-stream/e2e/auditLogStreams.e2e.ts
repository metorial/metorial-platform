import {
  eventually,
  expectOk,
  expectServiceError,
  firstPage,
  uniqueId,
  useOrganization
} from '@metorial/e2e';
import { db, loadOrganizationFixture, type OrganizationFixture } from '@metorial/e2e/db';
import { auditLogService } from '@metorial/module-audit-log';
import { describe, expect, it } from 'vitest';
import {
  auditLogStreamEventService,
  auditLogStreamService,
  decryptAuditLogStreamProviderData,
  validateAuditLogStreamProviderData,
  type AuditLogStreamProvider
} from '../src';
import { listStreamEvents } from './_fixtures';

let datadogData = () => ({ apiKey: uniqueId('dd-key'), site: 'e2e-audit.datadoghq.com' });

let splunkData = () => ({
  endpoint: 'https://e2e-audit.splunkcloud.com/services/collector/event',
  token: uniqueId('splunk-token')
});

// Streams are created active and the worker syncs active streams of dirty organizations, so every
// stream is switched off right away to keep the worker from calling the real provider hosts.
let createInactiveStream = async (
  fixture: OrganizationFixture,
  provider: AuditLogStreamProvider = 'datadog',
  providerData: Record<string, unknown> = datadogData()
) => {
  let created = await auditLogStreamService.createAuditLogStream({
    organization: fixture.organization,
    auditScope: fixture.auditScope,
    input: { provider, providerData }
  });
  let stream = await auditLogStreamService.updateAuditLogStream({
    organization: fixture.organization,
    auditLogStream: created,
    auditScope: fixture.auditScope,
    input: { status: 'inactive' }
  });

  return { created, stream, providerData };
};

let invalidDestinations: [AuditLogStreamProvider, Record<string, unknown>][] = [
  ['datadog', { apiKey: 'key', site: 'example.com' }],
  ['datadog', { apiKey: 'key', site: 'datadoghq.com.evil.com' }],
  ['datadog', { apiKey: 'key', site: 'evil.com/.datadoghq.com' }],
  ['datadog', { apiKey: 'key', site: 'evil.com#.datadoghq.com' }],
  ['datadog', { apiKey: 'key', site: '127.0.0.1' }],
  ['datadog', { apiKey: 'key', site: 'localhost' }],
  ['datadog', { apiKey: 'key', site: '169.254.169.254' }],
  ['datadog', { apiKey: '', site: 'datadoghq.com' }],
  ['datadog', { site: 'datadoghq.com' }],
  ['splunk', { endpoint: 'http://acme.splunkcloud.com/services/collector', token: 't' }],
  ['splunk', { endpoint: 'https://127.0.0.1:8088/services/collector', token: 't' }],
  ['splunk', { endpoint: 'https://localhost/services/collector', token: 't' }],
  ['splunk', { endpoint: 'https://169.254.169.254/latest/meta-data', token: 't' }],
  ['splunk', { endpoint: 'https://splunkcloud.com.evil.com/services/collector', token: 't' }],
  ['splunk', { endpoint: 'https://evilsplunkcloud.com/services/collector', token: 't' }],
  [
    'splunk',
    { endpoint: 'https://user:pass@acme.splunkcloud.com/services/collector', token: 't' }
  ],
  [
    'splunk',
    { endpoint: 'https://acme.splunkcloud.com@127.0.0.1/services/collector', token: 't' }
  ],
  ['splunk', { endpoint: 'file:///etc/passwd', token: 't' }],
  ['splunk', { endpoint: 'not a url', token: 't' }],
  ['splunk', { endpoint: 'https://acme.splunkcloud.com/services/collector', token: '' }]
];

let validDestinations: [AuditLogStreamProvider, Record<string, unknown>][] = [
  ['datadog', { apiKey: 'key', site: 'datadoghq.com' }],
  ['datadog', { apiKey: 'key', site: 'us5.datadoghq.com' }],
  ['datadog', { apiKey: 'key', site: 'datadoghq.eu' }],
  ['datadog', { apiKey: 'key', site: 'ddog-gov.com' }],
  ['splunk', { endpoint: 'https://acme.splunkcloud.com/services/collector', token: 't' }],
  [
    'splunk',
    {
      endpoint: 'https://http-inputs-acme.splunkcloud.com:443/services/collector/event',
      token: 't',
      index: 'main',
      source: 'metorial',
      sourcetype: '_json'
    }
  ]
];

describe('module-audit-log-stream streams', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  it('creates a stream with encrypted provider data and marks the organization dirty', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let providerData = datadogData();

    let created = await auditLogStreamService.createAuditLogStream({
      organization: fixture.organization,
      auditScope: fixture.auditScope,
      input: { provider: 'datadog', providerData }
    });
    let dirty = await db.auditLogDirtyTracker.findUnique({
      where: { organizationOid: fixture.organization.oid }
    });
    let stream = await auditLogStreamService.updateAuditLogStream({
      organization: fixture.organization,
      auditLogStream: created,
      auditScope: fixture.auditScope,
      input: { status: 'inactive' }
    });

    expect(dirty).not.toBeNull();
    expect(created).toMatchObject({
      provider: 'datadog',
      status: 'active',
      accessStatus: 'ok',
      isStarted: false,
      isPausedDueToError: false,
      consecutiveErrorCount: 0,
      lastAuditLogOid: null,
      organizationOid: fixture.organization.oid,
      providerDataRedacted: { site: providerData.site }
    });

    let row = await db.auditLogStream.findUniqueOrThrow({ where: { id: created.id } });
    expect(row.status).toBe('inactive');
    expect(row.encryptedProviderData).not.toContain(providerData.apiKey);
    expect(JSON.stringify(row.providerDataRedacted)).not.toContain(providerData.apiKey);
    expect(
      await decryptAuditLogStreamProviderData({
        streamId: row.id,
        provider: 'datadog',
        encryptedProviderData: row.encryptedProviderData
      })
    ).toEqual(providerData);

    let events = await listStreamEvents(stream.oid);
    expect(events.map(event => event.type)).toEqual(['created', 'disabled']);
  });

  it('rejects destinations outside the provider allowlist', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let before = await db.auditLogStream.count({
      where: { organizationOid: fixture.organization.oid }
    });

    let accepted: Record<string, unknown>[] = [];
    for (let [provider, providerData] of invalidDestinations) {
      try {
        await expectServiceError(
          auditLogStreamService.createAuditLogStream({
            organization: fixture.organization,
            auditScope: fixture.auditScope,
            input: { provider, providerData }
          }),
          'invalid_data'
        );
      } catch {
        accepted.push(providerData);
      }
    }

    let after = await db.auditLogStream.count({
      where: { organizationOid: fixture.organization.oid }
    });
    if (after > before) {
      await db.auditLogStream.updateMany({
        where: { organizationOid: fixture.organization.oid },
        data: { status: 'inactive' }
      });
    }

    expect(accepted).toEqual([]);
    expect(after).toBe(before);
  });

  it('accepts every documented provider host', () => {
    for (let [provider, providerData] of validDestinations) {
      expect(validateAuditLogStreamProviderData(provider, providerData)).toEqual(providerData);
    }
  });

  it('updates provider data and status and records only real status transitions', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let { stream } = await createInactiveStream(fixture);

    await expectServiceError(
      auditLogStreamService.updateAuditLogStream({
        organization: fixture.organization,
        auditLogStream: stream,
        auditScope: fixture.auditScope,
        input: { provider: 'splunk' }
      }),
      'bad_request'
    );
    await expectServiceError(
      auditLogStreamService.updateAuditLogStream({
        organization: fixture.organization,
        auditLogStream: stream,
        auditScope: fixture.auditScope,
        input: { providerData: { apiKey: 'key', site: 'localhost' } }
      }),
      'invalid_data'
    );
    let unchanged = await db.auditLogStream.findUniqueOrThrow({ where: { oid: stream.oid } });
    expect(unchanged.encryptedProviderData).toBe(stream.encryptedProviderData);

    let splunk = splunkData();
    let switched = await auditLogStreamService.updateAuditLogStream({
      organization: fixture.organization,
      auditLogStream: stream,
      auditScope: fixture.auditScope,
      input: { provider: 'splunk', providerData: splunk }
    });
    expect(switched).toMatchObject({
      provider: 'splunk',
      status: 'inactive',
      providerDataRedacted: { endpoint: splunk.endpoint }
    });
    expect(
      await decryptAuditLogStreamProviderData({
        streamId: switched.id,
        provider: 'splunk',
        encryptedProviderData: switched.encryptedProviderData
      })
    ).toEqual(splunk);

    let stillInactive = await auditLogStreamService.updateAuditLogStream({
      organization: fixture.organization,
      auditLogStream: switched,
      auditScope: fixture.auditScope,
      input: { status: 'inactive' }
    });
    let enabled = await auditLogStreamService.updateAuditLogStream({
      organization: fixture.organization,
      auditLogStream: stillInactive,
      auditScope: fixture.auditScope,
      input: { status: 'active' }
    });
    let disabled = await auditLogStreamService.updateAuditLogStream({
      organization: fixture.organization,
      auditLogStream: enabled,
      auditScope: fixture.auditScope,
      input: { status: 'inactive' }
    });
    expect(disabled.status).toBe('inactive');

    let events = await firstPage(
      await auditLogStreamEventService.listAuditLogStreamEvents({ auditLogStream: disabled })
    );
    expect(events.map(event => event.type).sort()).toEqual([
      'created',
      'disabled',
      'disabled',
      'enabled'
    ]);
    expect(events.every(event => event.auditLogStreamOid == stream.oid)).toBe(true);

    await expectServiceError(
      auditLogStreamService.resumeAuditLogStream({
        organization: fixture.organization,
        auditLogStream: disabled,
        auditScope: fixture.auditScope
      }),
      'bad_request'
    );
  });

  it('deletes a stream together with its events and runs', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let { stream } = await createInactiveStream(fixture);

    await db.auditLogStreamRun.create({
      data: {
        id: uniqueId('e2e-run'),
        status: 'success',
        batchIdentifier: uniqueId('e2e-batch'),
        batchNumber: 1,
        successfulBatchCount: 1,
        recordsSynced: 0,
        auditLogStreamOid: stream.oid
      }
    });

    let deleted = await auditLogStreamService.deleteAuditLogStream({
      organization: fixture.organization,
      auditLogStream: stream,
      auditScope: fixture.auditScope
    });
    expect(deleted.id).toBe(stream.id);

    expect(await db.auditLogStream.findUnique({ where: { id: stream.id } })).toBeNull();
    expect(
      await db.auditLogStreamEvent.count({ where: { auditLogStreamOid: stream.oid } })
    ).toBe(0);
    expect(
      await db.auditLogStreamRun.count({ where: { auditLogStreamOid: stream.oid } })
    ).toBe(0);
  });

  it('keeps streams and their events inside their organization', async () => {
    let [fixture, otherFixture] = await Promise.all([
      loadOrganizationFixture(org.ids),
      loadOrganizationFixture(otherOrg.ids)
    ]);
    let { stream } = await createInactiveStream(fixture);
    let { stream: otherStream } = await createInactiveStream(otherFixture);

    let streams = await firstPage(
      await auditLogStreamService.listAuditLogStreams({ organization: fixture.organization })
    );
    let otherStreams = await firstPage(
      await auditLogStreamService.listAuditLogStreams({
        organization: otherFixture.organization
      })
    );

    expect(streams.map(item => item.id)).toContain(stream.id);
    expect(streams.map(item => item.id)).not.toContain(otherStream.id);
    expect(otherStreams.map(item => item.id)).toEqual([otherStream.id]);
    expect(streams.every(item => item.organizationOid == fixture.organization.oid)).toBe(true);

    let otherEvents = await firstPage(
      await auditLogStreamEventService.listAuditLogStreamEvents({
        auditLogStream: otherStream
      })
    );
    expect(otherEvents.length).toBeGreaterThan(0);
    expect(otherEvents.every(event => event.auditLogStreamOid == otherStream.oid)).toBe(true);
  });

  it('audits stream changes made over REST without storing the provider secret', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let base = `/dashboard/organizations/${org.ids.organizationId}/audit-log-streams`;
    let providerData = datadogData();

    let created = expectOk(
      await org.clients.rest.post(base, { provider: 'datadog', provider_data: providerData })
    );
    let disabled = expectOk(
      await org.clients.rest.patch(`${base}/${created.id}`, { status: 'inactive' })
    );
    expectOk(await org.clients.rest.delete(`${base}/${created.id}`));

    expect(disabled.status).toBe('inactive');
    expect(JSON.stringify([created, disabled])).not.toContain(providerData.apiKey);

    let entries = await eventually(
      async () => {
        let page = await (
          await auditLogService.listAuditLogs({ organizationId: org.ids.organizationId })
        ).run({ limit: 100 });
        let entries = page.items.filter(
          item =>
            item.resource == 'audit_log_stream' && (item.payload as any)?.id == created.id
        );
        expect(entries.map(entry => entry.action).sort()).toEqual([
          'create',
          'delete',
          'update'
        ]);
        return entries;
      },
      { timeoutMs: 150_000, intervalMs: 2_000 }
    );

    expect(JSON.stringify(entries)).not.toContain(providerData.apiKey);

    let create = entries.find(entry => entry.action == 'create')!;
    expect(create).toMatchObject({
      organizationId: org.ids.organizationId,
      actor: { type: 'org_actor', id: fixture.actor.id },
      payload: {
        id: created.id,
        provider: 'datadog',
        status: 'active',
        providerDataRedacted: { site: providerData.site }
      }
    });

    let update = entries.find(entry => entry.action == 'update')!;
    expect(update.payload).toMatchObject({ id: created.id, status: 'inactive' });
    expect(update.previousAttributes).toEqual({ status: 'active' });
  }, 180_000);
});
