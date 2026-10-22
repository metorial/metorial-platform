import {
  eventually,
  expectServiceError,
  firstPage,
  uniqueId,
  useOrganization
} from '@metorial/e2e';
import { db, loadOrganizationFixture, type OrganizationFixture } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import { eventDestinationService, type EventDestinationRetryInput } from '../src';

let publicUrl = () => `https://example.com/webhooks/${uniqueId('hook')}`;

let createDestination = (
  fixture: OrganizationFixture,
  input: {
    name?: string;
    description?: string | null;
    url?: string;
    retry?: EventDestinationRetryInput;
  } = {}
) =>
  eventDestinationService.createEventDestination({
    organization: fixture.organization,
    auditScope: fixture.auditScope,
    input: {
      name: input.name ?? uniqueId('destination'),
      description: input.description,
      type: 'webhook',
      webhook: { url: input.url ?? publicUrl() },
      retry: input.retry
    }
  });

let persisted = (eventDestinationId: string) =>
  db.eventDestination.findUniqueOrThrow({
    where: { id: eventDestinationId },
    include: { webhookDestination: true }
  });

let listIds = async (
  fixture: OrganizationFixture,
  input: { statuses?: ('active' | 'archived')[]; search?: string } = {}
) =>
  (
    await firstPage(
      await eventDestinationService.listEventDestinations({
        organization: fixture.organization,
        ...input
      })
    )
  ).map(item => item.id);

describe('module-event-destination: event destinations', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  it('creates a webhook destination with a fresh signing secret and the default retry policy', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let url = publicUrl();

    let created = await createDestination(fixture, { url, description: 'Production events' });
    expect(created).toMatchObject({
      status: 'active',
      type: 'webhook',
      description: 'Production events',
      archivedAt: null,
      retryStrategy: 'exponential',
      retryMaxAttempts: 25,
      retryBaseDelaySeconds: 10,
      retryMaxDelaySeconds: 10800,
      listeners: []
    });
    expect(created.webhookDestination).toMatchObject({ url, method: 'POST' });
    expect(created.webhookDestination!.signingSecret).toMatch(/^metorial_whsec_/);

    let row = await persisted(created.id);
    expect(row.organizationOid).toBe(fixture.organization.oid);
    expect(row.webhookDestination).toMatchObject({
      url,
      method: 'POST',
      organizationOid: fixture.organization.oid,
      signingSecret: created.webhookDestination!.signingSecret
    });

    let second = await createDestination(fixture);
    expect(second.webhookDestination!.signingSecret).not.toBe(
      created.webhookDestination!.signingSecret
    );
  });

  it('updates name, description, url and retry policy without touching the signing secret', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let created = await createDestination(fixture, {
      description: 'Before',
      retry: { strategy: 'linear', maxAttempts: 3, baseDelaySeconds: 5, maxDelaySeconds: 60 }
    });
    let nextUrl = publicUrl();

    let updated = await eventDestinationService.updateEventDestination({
      organization: fixture.organization,
      eventDestination: created,
      auditScope: fixture.auditScope,
      input: {
        name: `${created.name}-renamed`,
        description: null,
        webhook: { url: nextUrl },
        retry: { maxAttempts: 7 }
      }
    });
    expect(updated).toMatchObject({
      name: `${created.name}-renamed`,
      description: null,
      retryStrategy: 'linear',
      retryMaxAttempts: 7,
      retryBaseDelaySeconds: 5,
      retryMaxDelaySeconds: 60
    });

    let row = await persisted(created.id);
    expect(row.webhookDestination!.url).toBe(nextUrl);
    expect(row.webhookDestination!.signingSecret).toBe(
      created.webhookDestination!.signingSecret
    );

    let untouched = await eventDestinationService.updateEventDestination({
      organization: fixture.organization,
      eventDestination: updated,
      auditScope: fixture.auditScope,
      input: { webhook: {} }
    });
    expect(untouched.webhookDestination!.url).toBe(nextUrl);
  });

  it('archives a destination and rejects every later mutation', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let created = await createDestination(fixture);

    let archived = await eventDestinationService.archiveEventDestination({
      organization: fixture.organization,
      eventDestination: created,
      auditScope: fixture.auditScope
    });
    expect(archived.status).toBe('archived');
    expect(archived.archivedAt).toBeInstanceOf(Date);
    expect((await persisted(created.id)).status).toBe('archived');

    let fetched = await eventDestinationService.getEventDestinationById({
      organization: fixture.organization,
      eventDestinationId: created.id
    });
    expect(fetched.status).toBe('archived');

    await expectServiceError(
      eventDestinationService.archiveEventDestination({
        organization: fixture.organization,
        eventDestination: archived,
        auditScope: fixture.auditScope
      }),
      'bad_request'
    );
    await expectServiceError(
      eventDestinationService.updateEventDestination({
        organization: fixture.organization,
        eventDestination: archived,
        auditScope: fixture.auditScope,
        input: { name: 'not-allowed' }
      }),
      'bad_request'
    );
    await expectServiceError(
      eventDestinationService.rotateWebhookSecret({
        organization: fixture.organization,
        eventDestination: archived,
        auditScope: fixture.auditScope
      }),
      'bad_request'
    );
    expect((await persisted(created.id)).name).toBe(created.name);

    expect(await listIds(fixture)).not.toContain(created.id);
    expect(await listIds(fixture, { statuses: ['archived'] })).toContain(created.id);
    expect(await listIds(fixture, { statuses: ['active', 'archived'] })).toContain(created.id);
  });

  it('rotates the signing secret, persisting only the newest one', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let created = await createDestination(fixture);
    let original = created.webhookDestination!.signingSecret;

    let first = await eventDestinationService.rotateWebhookSecret({
      organization: fixture.organization,
      eventDestination: created,
      auditScope: fixture.auditScope
    });
    expect(first.signingSecret).toMatch(/^metorial_whsec_/);
    expect(first.signingSecret).not.toBe(original);
    expect(first.eventDestination.webhookDestination!.signingSecret).toBe(first.signingSecret);

    let second = await eventDestinationService.rotateWebhookSecret({
      organization: fixture.organization,
      eventDestination: first.eventDestination,
      auditScope: fixture.auditScope
    });
    expect(second.signingSecret).not.toBe(first.signingSecret);
    expect((await persisted(created.id)).webhookDestination!.signingSecret).toBe(
      second.signingSecret
    );
  });

  it('rejects destination urls that are not public http(s) addresses', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let rejected = [
      'not a url',
      'ftp://example.com/hook',
      'file:///etc/passwd',
      'javascript:alert(1)',
      'https://user:secret@example.com/hook',
      'http://127.0.0.1/hook',
      'http://127.1.2.3:8080/hook',
      'http://2130706433/hook',
      'http://0x7f000001/hook',
      'http://0.0.0.0/hook',
      'http://[::1]/hook',
      'http://[::ffff:127.0.0.1]/hook',
      'http://10.0.0.5/hook',
      'http://172.16.0.1/hook',
      'http://192.168.1.10/hook',
      'http://100.64.0.1/hook',
      'http://169.254.169.254/latest/meta-data/',
      'http://[fd00::1]/hook',
      'http://[fe80::1]/hook'
    ];

    for (let url of rejected) {
      let error = await expectServiceError(createDestination(fixture, { url }), 'bad_request');
      expect(error.message, url).toMatch(/Delivery URL/);
    }

    let accepted = await createDestination(fixture, { url: 'http://example.com:8080/hook' });
    expect(accepted.webhookDestination!.url).toBe('http://example.com:8080/hook');
    await createDestination(fixture, { url: 'https://93.184.216.34/hook' });
  });

  it('accepts internal hostnames at creation, leaving them to the delivery-time DNS guard', async () => {
    let fixture = await loadOrganizationFixture(org.ids);

    let created = await createDestination(fixture, {
      url: 'http://metadata.google.internal/computeMetadata/v1/'
    });
    expect(created.webhookDestination!.url).toBe(
      'http://metadata.google.internal/computeMetadata/v1/'
    );
  });

  it.fails(
    'rejects localhost destination urls at creation (bug: assertDeliveryUrlAllowed only checks IP literals, so http://localhost passes although the error description promises loopback is rejected)',
    async () => {
      let fixture = await loadOrganizationFixture(org.ids);

      await expectServiceError(
        createDestination(fixture, { url: 'http://localhost:8080/hook' }),
        'bad_request'
      );
    }
  );

  it('validates the url on update and keeps the stored url when it is rejected', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let created = await createDestination(fixture);

    for (let url of ['http://127.0.0.1/hook', 'http://169.254.169.254/', 'gopher://x', '']) {
      await expectServiceError(
        eventDestinationService.updateEventDestination({
          organization: fixture.organization,
          eventDestination: created,
          auditScope: fixture.auditScope,
          input: { webhook: { url } }
        }),
        'bad_request'
      );
    }

    expect((await persisted(created.id)).webhookDestination!.url).toBe(
      created.webhookDestination!.url
    );
  });

  it('validates retry settings on create and update', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let invalid: EventDestinationRetryInput[] = [
      { maxAttempts: 0 },
      { maxAttempts: 26 },
      { maxAttempts: 1.5 },
      { baseDelaySeconds: 0 },
      { baseDelaySeconds: 86_401 },
      { maxDelaySeconds: 0 },
      { maxDelaySeconds: 86_401 }
    ];

    for (let retry of invalid) {
      let error = await expectServiceError(
        createDestination(fixture, { retry }),
        'bad_request'
      );
      expect(error.message, JSON.stringify(retry)).toMatch(/^retry\./);
    }

    let boundary = await createDestination(fixture, {
      retry: {
        strategy: 'fixed',
        maxAttempts: 25,
        baseDelaySeconds: 1,
        maxDelaySeconds: 86_400
      }
    });
    expect(boundary).toMatchObject({
      retryStrategy: 'fixed',
      retryMaxAttempts: 25,
      retryBaseDelaySeconds: 1,
      retryMaxDelaySeconds: 86_400
    });

    await expectServiceError(
      eventDestinationService.updateEventDestination({
        organization: fixture.organization,
        eventDestination: boundary,
        auditScope: fixture.auditScope,
        input: { retry: { maxAttempts: 30 } }
      }),
      'bad_request'
    );
    expect((await persisted(boundary.id)).retryMaxAttempts).toBe(25);
  });

  it('finds destinations by name through search and drops them from the index once archived', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let otherFixture = await loadOrganizationFixture(otherOrg.ids);
    let token = uniqueId('evtdsearch').replace(/-/g, '');
    let created = await createDestination(fixture, { name: `Searchable ${token}` });
    await createDestination(fixture);

    await eventually(
      async () => expect(await listIds(fixture, { search: token })).toEqual([created.id]),
      { timeoutMs: 45_000, intervalMs: 500 }
    );
    expect(await listIds(otherFixture, { search: token })).toEqual([]);

    await eventDestinationService.archiveEventDestination({
      organization: fixture.organization,
      eventDestination: created,
      auditScope: fixture.auditScope
    });

    await eventually(
      async () =>
        expect(await listIds(fixture, { search: token, statuses: ['archived'] })).toEqual([]),
      { timeoutMs: 45_000, intervalMs: 500 }
    );
    expect(await listIds(fixture, { statuses: ['archived'] })).toContain(created.id);
  }, 120_000);

  it("hides one organization's destinations from another", async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let otherFixture = await loadOrganizationFixture(otherOrg.ids);
    let created = await createDestination(fixture);
    let otherCreated = await createDestination(otherFixture);

    let error = await expectServiceError(
      eventDestinationService.getEventDestinationById({
        organization: otherFixture.organization,
        eventDestinationId: created.id
      }),
      'not_found'
    );
    expect(error.status).toBe(404);

    let otherIds = await listIds(otherFixture, { statuses: ['active', 'archived'] });
    expect(otherIds).toContain(otherCreated.id);
    expect(otherIds).not.toContain(created.id);
    expect(await listIds(fixture)).not.toContain(otherCreated.id);
  });
});
