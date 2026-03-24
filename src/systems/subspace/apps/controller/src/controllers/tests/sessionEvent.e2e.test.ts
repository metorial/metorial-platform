import { getId } from '@metorial-subspace/db';
import { beforeEach, describe, expect, it } from 'vitest';
import { createSubspaceControllerRootTestClient } from '../../test/client';
import { cleanDatabase, testDb } from '../../test/setup';

describe('sessionEvent.e2e', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it('lists and fetches warning session events with nested warning fields', async () => {
    let anonymousClient = createSubspaceControllerRootTestClient();
    let solution = await anonymousClient.solution.upsert({
      name: 'Test Solution',
      identifier: 'test-solution'
    });

    let client = createSubspaceControllerRootTestClient({
      headers: {
        'Subspace-Solution-Id': solution.id
      }
    });

    let tenant = await client.tenant.upsert({
      name: 'Test Tenant',
      identifier: 'test-tenant',
      environments: [
        {
          name: 'Development',
          identifier: 'test-tenant-dev',
          type: 'development'
        }
      ]
    });

    let [tenantRecord, environmentRecord, solutionRecord] = await Promise.all([
      testDb.tenant.findUnique({ where: { id: tenant.id } }),
      testDb.environment.findUnique({ where: { identifier: 'test-tenant-dev' } }),
      testDb.solution.findUnique({ where: { id: solution.id } })
    ]);

    if (!tenantRecord || !environmentRecord || !solutionRecord) {
      throw new Error('Test setup failed to resolve tenant/environment/solution records');
    }

    let session = await testDb.session.create({
      data: {
        ...getId('session'),
        status: 'active',
        isEphemeral: false,
        name: 'Test Session',
        tenantOid: tenantRecord.oid,
        environmentOid: environmentRecord.oid,
        solutionOid: solutionRecord.oid
      }
    });

    let warningPayload = {
      source: 'provider-discovery',
      attempt: 1
    };

    let warning = await testDb.sessionWarning.create({
      data: {
        ...getId('sessionWarning'),
        code: 'provider_discovery_warning',
        message: 'Provider discovered with warnings',
        payload: warningPayload,
        sessionOid: session.oid,
        tenantOid: tenantRecord.oid,
        environmentOid: environmentRecord.oid,
        solutionOid: solutionRecord.oid
      }
    });

    let sessionEvent = await testDb.sessionEvent.create({
      data: {
        ...getId('sessionEvent'),
        type: 'warning_occurred',
        sessionOid: session.oid,
        warningOid: warning.oid,
        tenantOid: tenantRecord.oid,
        environmentOid: environmentRecord.oid,
        solutionOid: solutionRecord.oid
      }
    });

    let listed = await client.sessionEvent.list({
      tenantId: tenant.id,
      environmentId: environmentRecord.id,
      sessionIds: [session.id],
      types: ['warning_occurred'],
      limit: 10
    });

    expect(listed).toMatchObject({
      object: 'list',
      items: [
        expect.objectContaining({
          id: sessionEvent.id,
          type: 'warning_occurred',
          sessionId: session.id,
          warning: expect.objectContaining({
            object: 'session.warning',
            id: warning.id,
            code: warning.code,
            message: warning.message,
            data: warningPayload,
            sessionId: session.id,
            createdAt: expect.any(Date)
          })
        })
      ]
    });

    let fetched = await client.sessionEvent.get({
      tenantId: tenant.id,
      environmentId: environmentRecord.id,
      sessionEventId: sessionEvent.id
    });

    expect(fetched).toMatchObject({
      id: sessionEvent.id,
      type: 'warning_occurred',
      sessionId: session.id,
      warning: expect.objectContaining({
        object: 'session.warning',
        id: warning.id,
        code: warning.code,
        message: warning.message,
        data: warningPayload,
        sessionId: session.id,
        createdAt: expect.any(Date)
      })
    });
  });
});
