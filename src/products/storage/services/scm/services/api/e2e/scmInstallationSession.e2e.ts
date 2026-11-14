import { uniqueId } from '@lowerdeck/testing-tools';
import { describe, expect, it } from 'vitest';
import { db } from '../src/db';
import { origin } from './client';
import { expectRpcError } from './errors';
import { createActor, createBackend, createInstallation, createTenant } from './fixtures';

describe('origin scm installation session', () => {
  it('creates a pending session', async () => {
    let tenant = await createTenant();
    let actor = await createActor();

    let before = Date.now();
    let session = await origin.scmInstallationSession.create({
      tenantId: tenant.id,
      actorId: actor.id,
      redirectUrl: 'https://app.example.test/done'
    });

    expect(session).toMatchObject({
      status: 'pending',
      installation: null,
      createdAt: expect.any(Date),
      expiresAt: expect.any(Date)
    });
    expect(session.url).toContain(`/origin/scm/installation-session/${session.id}`);

    let ttl = session.expiresAt.getTime() - before;
    expect(ttl).toBeGreaterThan(29 * 60 * 1000);
    expect(ttl).toBeLessThan(31 * 60 * 1000);

    let row = await db.scmInstallationSession.findUniqueOrThrow({ where: { id: session.id } });
    expect(row).toMatchObject({
      tenantOid: tenant.oid,
      ownerActorOid: actor.oid,
      redirectUrl: 'https://app.example.test/done',
      status: 'pending'
    });
    expect(row.state).toMatch(/^[0-9a-f]{64}$/);
  });

  it('keeps the oauth state private', async () => {
    let tenant = await createTenant();
    let actor = await createActor();

    let session = await origin.scmInstallationSession.create({
      tenantId: tenant.id,
      actorId: actor.id
    });
    let row = await db.scmInstallationSession.findUniqueOrThrow({ where: { id: session.id } });

    expect(JSON.stringify(session)).not.toContain(row.state);
    expect(Object.keys(session)).not.toContain('state');
  });

  it('generates a unique id and state per session', async () => {
    let tenant = await createTenant();
    let actor = await createActor();

    let sessions = await Promise.all(
      [1, 2, 3].map(() =>
        origin.scmInstallationSession.create({ tenantId: tenant.id, actorId: actor.id })
      )
    );

    expect(new Set(sessions.map(s => s.id)).size).toBe(3);

    let rows = await db.scmInstallationSession.findMany({
      where: { id: { in: sessions.map(s => s.id) } }
    });
    expect(new Set(rows.map(r => r.state)).size).toBe(3);
  });

  it('gets a session', async () => {
    let tenant = await createTenant();
    let actor = await createActor();
    let session = await origin.scmInstallationSession.create({
      tenantId: tenant.id,
      actorId: actor.id
    });

    let fetched = await origin.scmInstallationSession.get({
      tenantId: tenant.id,
      sessionId: session.id
    });

    expect(fetched).toMatchObject({ id: session.id, status: 'pending', installation: null });
  });

  it('reports a completed session with its installation', async () => {
    let tenant = await createTenant();
    let actor = await createActor();
    let backend = await createBackend(tenant.id);
    let backendRow = await db.scmBackend.findUniqueOrThrow({ where: { id: backend.id } });

    let session = await origin.scmInstallationSession.create({
      tenantId: tenant.id,
      actorId: actor.id
    });
    let installation = await createInstallation({
      tenantOid: tenant.oid,
      actorOid: actor.oid,
      backendOid: backendRow.oid,
      accountLogin: 'acme'
    });

    await db.scmInstallationSession.update({
      where: { id: session.id },
      data: { installationOid: installation.oid, status: 'succeeded' }
    });

    let fetched = await origin.scmInstallationSession.get({
      tenantId: tenant.id,
      sessionId: session.id
    });

    expect(fetched.status).toBe('completed');
    expect(fetched.installation).toMatchObject({
      id: installation.id,
      externalAccountLogin: 'acme'
    });
    expect(JSON.stringify(fetched)).not.toContain('secret-access-token');
    expect(JSON.stringify(fetched)).not.toContain('secret-refresh-token');
  });

  it('reports an expired session but still returns it', async () => {
    let tenant = await createTenant();
    let actor = await createActor();
    let session = await origin.scmInstallationSession.create({
      tenantId: tenant.id,
      actorId: actor.id
    });

    await db.scmInstallationSession.update({
      where: { id: session.id },
      data: { expiresAt: new Date(Date.now() - 60_000) }
    });

    let fetched = await origin.scmInstallationSession.get({
      tenantId: tenant.id,
      sessionId: session.id
    });

    expect(fetched.status).toBe('expired');
  });

  it('isolates sessions between tenants', async () => {
    let owner = await createTenant();
    let other = await createTenant();
    let actor = await createActor();
    let session = await origin.scmInstallationSession.create({
      tenantId: owner.id,
      actorId: actor.id
    });

    await expectRpcError(
      origin.scmInstallationSession.get({ tenantId: other.id, sessionId: session.id }),
      'not_found'
    );
  });

  it('rejects unknown sessions and actors', async () => {
    let tenant = await createTenant();
    let actor = await createActor();

    await expectRpcError(
      origin.scmInstallationSession.get({
        tenantId: tenant.id,
        sessionId: uniqueId('missing')
      }),
      'not_found'
    );
    await expectRpcError(
      origin.scmInstallationSession.create({
        tenantId: tenant.id,
        actorId: uniqueId('missing')
      }),
      'not_found'
    );
    expect(actor.id).toBeTruthy();
  });

  it('validates the create input', async () => {
    let tenant = await createTenant();

    await expectRpcError(
      origin.scmInstallationSession.create({ tenantId: tenant.id } as any),
      'invalid_data'
    );
  });
});
