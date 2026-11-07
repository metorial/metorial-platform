import { uniqueId } from '@lowerdeck/testing-tools';
import { describe, expect, it } from 'vitest';
import { db } from '../src/db';
import { origin } from './client';
import { expectRpcError } from './errors';
import { createActor, createBackend, createTenant } from './fixtures';

describe('origin scm backend setup session', () => {
  it('creates a pending setup session', async () => {
    let tenant = await createTenant();

    let session = await origin.scmBackendSetupSession.create({
      tenantId: tenant.id,
      type: 'gitlab_selfhosted',
      redirectUrl: 'https://app.example.test/back'
    });

    expect(session).toMatchObject({
      object: 'origin#scmBackendSetupSession',
      type: 'gitlab_selfhosted',
      status: 'pending',
      backend: null,
      parentInstallationSessionId: null
    });
    expect(session.url).toContain(`/origin/scm/backend-setup/${session.id}`);

    let ttl = session.expiresAt.getTime() - Date.now();
    expect(ttl).toBeGreaterThan(28 * 60 * 1000);
    expect(ttl).toBeLessThan(31 * 60 * 1000);

    let row = await db.scmBackendSetupSession.findUniqueOrThrow({ where: { id: session.id } });
    expect(row).toMatchObject({
      tenantOid: tenant.oid,
      type: 'gitlab_selfhosted',
      redirectUrl: 'https://app.example.test/back'
    });
    expect(row.state).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(session)).not.toContain(row.state);
  });

  it('links a parent installation session', async () => {
    let tenant = await createTenant();
    let actor = await createActor();
    let parent = await origin.scmInstallationSession.create({
      tenantId: tenant.id,
      actorId: actor.id
    });

    let session = await origin.scmBackendSetupSession.create({
      tenantId: tenant.id,
      type: 'github_enterprise',
      parentInstallationSessionId: parent.id
    });

    expect(session.parentInstallationSessionId).toBe(parent.id);

    let fetched = await origin.scmBackendSetupSession.get({
      tenantId: tenant.id,
      sessionId: session.id
    });
    expect(fetched.parentInstallationSessionId).toBe(parent.id);
  });

  it('rejects a parent session of another tenant', async () => {
    let tenant = await createTenant();
    let other = await createTenant();
    let actor = await createActor();
    let parent = await origin.scmInstallationSession.create({
      tenantId: other.id,
      actorId: actor.id
    });

    await expectRpcError(
      origin.scmBackendSetupSession.create({
        tenantId: tenant.id,
        type: 'gitlab_selfhosted',
        parentInstallationSessionId: parent.id
      }),
      'not_found'
    );
  });

  it('rejects an expired or unknown parent session', async () => {
    let tenant = await createTenant();
    let actor = await createActor();
    let parent = await origin.scmInstallationSession.create({
      tenantId: tenant.id,
      actorId: actor.id
    });

    await db.scmInstallationSession.update({
      where: { id: parent.id },
      data: { expiresAt: new Date(Date.now() - 1000) }
    });

    let error = await expectRpcError(
      origin.scmBackendSetupSession.create({
        tenantId: tenant.id,
        type: 'gitlab_selfhosted',
        parentInstallationSessionId: parent.id
      }),
      'bad_request'
    );
    expect(error.message).toContain('expired');

    await expectRpcError(
      origin.scmBackendSetupSession.create({
        tenantId: tenant.id,
        type: 'gitlab_selfhosted',
        parentInstallationSessionId: uniqueId('missing')
      }),
      'not_found'
    );
  });

  it('reports a completed session with its backend', async () => {
    let tenant = await createTenant();
    let session = await origin.scmBackendSetupSession.create({
      tenantId: tenant.id,
      type: 'gitlab_selfhosted'
    });
    let backend = await createBackend(tenant.id);
    let backendRow = await db.scmBackend.findUniqueOrThrow({ where: { id: backend.id } });

    await db.scmBackendSetupSession.update({
      where: { id: session.id },
      data: { backendOid: backendRow.oid }
    });

    let fetched = await origin.scmBackendSetupSession.get({
      tenantId: tenant.id,
      sessionId: session.id
    });

    expect(fetched.status).toBe('completed');
    expect(fetched.backend).toMatchObject({ id: backend.id, name: backend.name });
  });

  it('rejects an expired session', async () => {
    let tenant = await createTenant();
    let session = await origin.scmBackendSetupSession.create({
      tenantId: tenant.id,
      type: 'gitlab_selfhosted'
    });

    await db.scmBackendSetupSession.update({
      where: { id: session.id },
      data: { expiresAt: new Date(Date.now() - 1000) }
    });

    let error = await expectRpcError(
      origin.scmBackendSetupSession.get({ tenantId: tenant.id, sessionId: session.id }),
      'bad_request'
    );
    expect(error.message).toContain('expired');
  });

  it('isolates sessions between tenants', async () => {
    let owner = await createTenant();
    let other = await createTenant();
    let session = await origin.scmBackendSetupSession.create({
      tenantId: owner.id,
      type: 'gitlab_selfhosted'
    });

    await expectRpcError(
      origin.scmBackendSetupSession.get({ tenantId: other.id, sessionId: session.id }),
      'not_found'
    );
    await expectRpcError(
      origin.scmBackendSetupSession.get({
        tenantId: owner.id,
        sessionId: uniqueId('missing')
      }),
      'not_found'
    );
  });

  it('validates the type', async () => {
    let tenant = await createTenant();

    await expectRpcError(
      origin.scmBackendSetupSession.create({ tenantId: tenant.id, type: 'svn' as any }),
      'invalid_data'
    );
    await expectRpcError(
      origin.scmBackendSetupSession.create({ tenantId: tenant.id, type: 'github' as any }),
      'invalid_data'
    );
    await expectRpcError(
      origin.scmBackendSetupSession.create({ tenantId: tenant.id } as any),
      'invalid_data'
    );
  });
});
