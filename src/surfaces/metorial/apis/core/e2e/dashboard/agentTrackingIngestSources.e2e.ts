import {
  eventuallyAudited,
  expectAuthMatrix,
  expectError,
  expectOk,
  expectPresented,
  listAll,
  uniqueId,
  useMember,
  useOrganization
} from '@metorial/e2e';
import { agentTrackingPath } from '@metorial/agent-tracking-e2e';
import { db } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import {
  adminOnly,
  adminOnlyClients,
  outsiderOf,
  refusedToNonAdmins
} from '../_agentTracking';

describe('api-core dashboard: agent tracking ingestion keys', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let member = useMember(org);

  let sourcesPath = (path = '') => agentTrackingPath(org, `/ingest-sources${path}`);

  let createSource = async (name = uniqueId('Laptops')) =>
    expectOk(
      await org.clients.rest.post(sourcesPath(), { name, client_family: 'claude_code' })
    );

  it('lets only admins read and create keys', async () => {
    let clients = adminOnlyClients(org, member, otherOrg);

    await expectAuthMatrix(clients, client => client.get(sourcesPath()), adminOnly);
    await expectAuthMatrix(
      clients,
      client =>
        client.post(sourcesPath(), { name: uniqueId('Key'), client_family: 'claude_code' }),
      refusedToNonAdmins
    );
  });

  it('lets only admins read and revoke a single key', async () => {
    let created = await createSource();
    let clients = adminOnlyClients(org, member, otherOrg);

    await expectAuthMatrix(
      clients,
      client => client.post(sourcesPath(`/${created.id}/revoke`)),
      refusedToNonAdmins
    );
    await expectAuthMatrix(
      clients,
      client => client.get(sourcesPath(`/${created.id}`)),
      adminOnly
    );

    expect(expectOk(await org.clients.rest.get(sourcesPath(`/${created.id}`))).status).toBe(
      'active'
    );
  });

  it('validates the body and the status filter', async () => {
    for (let invalid of [
      {},
      { client_family: 'claude_code' },
      { name: '', client_family: 'claude_code' },
      { name: 'x'.repeat(201), client_family: 'claude_code' },
      { name: uniqueId('Key') },
      { name: uniqueId('Key'), client_family: 'cursor' }
    ]) {
      expectError(await org.clients.rest.post(sourcesPath(), invalid), 400, 'invalid_data');
    }

    expectError(
      await org.clients.rest.get(sourcesPath(), { query: { status: 'expired' } }),
      400,
      'invalid_data'
    );
  });

  it('presents the secret of a key only when it is created', async () => {
    let name = uniqueId('Engineering laptops');
    let created = expectPresented(await createSource(name), 'agent_tracking.ingest_source');

    expect(created).toMatchObject({
      status: 'active',
      name,
      client_family: 'claude_code',
      last_used_at: null,
      last_used_status: 'never_used',
      revoked_at: null
    });
    expect(created.id.startsWith('atis_')).toBe(true);
    expect(created.secret.startsWith('metorial_agis_')).toBe(true);
    expect(created.secret_redacted).not.toBe(created.secret);
    expect(created.secret_redacted.endsWith(created.secret.slice(-4))).toBe(true);
    expect(typeof created.ingest_url).toBe('string');

    let fetched = expectOk(await org.clients.rest.get(sourcesPath(`/${created.id}`)));
    expect(fetched).toMatchObject({ id: created.id, secret: null });
    expect(JSON.stringify(fetched)).not.toContain(created.secret);
    let row = await db.agentTrackingIngestSource.findUniqueOrThrow({
      where: { id: created.id }
    });
    expect(JSON.stringify(fetched)).not.toContain(row.serviceIngestSourceId);

    let listed = await listAll(org.clients.rest, sourcesPath());
    expect(listed.find(item => item.id === created.id)).toMatchObject({
      secret: null,
      secret_redacted: created.secret_redacted
    });
    expect(JSON.stringify(listed)).not.toContain(created.secret);
  });

  it('presents a revoked key and lists it only on request', async () => {
    let created = await createSource();

    let revoked = expectOk(await org.clients.rest.post(sourcesPath(`/${created.id}/revoke`)));
    expect(revoked).toMatchObject({ id: created.id, status: 'revoked', secret: null });
    expect(revoked.revoked_at).not.toBeNull();

    expect(
      (await listAll(org.clients.rest, sourcesPath())).map(item => item.id)
    ).not.toContain(created.id);
    expect(
      (await listAll(org.clients.rest, sourcesPath(), { query: { status: 'revoked' } })).map(
        item => item.id
      )
    ).toContain(created.id);
  });

  it('audits creation and revocation without the secret', async () => {
    let created = await createSource();
    expectOk(await org.clients.rest.post(sourcesPath(`/${created.id}/revoke`)));

    let logs = await eventuallyAudited(async () => {
      let body = expectOk(
        await org.clients.management.get('/organization/audit-logs', { query: { limit: 100 } })
      );
      let entries = body.items.filter((item: any) =>
        JSON.stringify(item).includes(created.id)
      );
      if (entries.length < 2) throw new Error('ingestion key not audited yet');

      return entries;
    });

    expect(JSON.stringify(logs)).not.toContain(created.secret);
  }, 180_000);

  it('pages through keys without duplicates', async () => {
    let first = await createSource();
    let second = await createSource();

    let ids = (await listAll(org.clients.rest, sourcesPath(), { limit: 1 })).map(
      item => item.id
    );

    expect(ids).toEqual(expect.arrayContaining([first.id, second.id]));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("hides another organization's keys", async () => {
    let created = await createSource();
    let foreign = expectOk(
      await otherOrg.clients.rest.post(agentTrackingPath(otherOrg, '/ingest-sources'), {
        name: uniqueId('Foreign'),
        client_family: 'claude_code'
      })
    );

    expectError(
      await outsiderOf(otherOrg).get(sourcesPath(`/${created.id}`)),
      404,
      'not_found'
    );
    expectError(await org.clients.rest.get(sourcesPath(`/${foreign.id}`)), 404, 'not_found');
    expectError(
      await org.clients.rest.post(sourcesPath(`/${foreign.id}/revoke`)),
      404,
      'not_found'
    );
    expect(
      (await listAll(org.clients.rest, sourcesPath())).map(item => item.id)
    ).not.toContain(foreign.id);

    let untouched = await db.agentTrackingIngestSource.findUniqueOrThrow({
      where: { id: foreign.id }
    });
    expect(untouched.status).toBe('active');
  });
});
