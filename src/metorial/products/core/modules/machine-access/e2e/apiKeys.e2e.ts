import { forbiddenError, ServiceError } from '@lowerdeck/error';
import {
  API_VERSIONS,
  eventually,
  expectOk,
  expectServiceError,
  firstPage,
  metorialEndpoints,
  rest,
  testContext,
  uniqueId,
  useOrganization
} from '@metorial/e2e';
import { db, loadOrganizationFixture } from '@metorial/e2e/db';
import { Fabric, type FabricEvents } from '@metorial/fabric';
import { afterEach, describe, expect, it } from 'vitest';
import { apiKeyService, machineAccessAuthService } from '../src';

type SecretRequestedEvent = FabricEvents['machine_access.secret.requested:before'];
type InstanceKeyType = 'instance_access_token_secret' | 'instance_access_token_publishable';

describe('module-machine-access api keys', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  let cleanups: (() => void)[] = [];

  afterEach(() => {
    for (let cleanup of cleanups.splice(0)) cleanup();
  });

  let createInstanceKey = async (
    input: { expiresAt?: Date; ipFilters?: string[]; instanceId?: string } = {},
    type: InstanceKeyType = 'instance_access_token_secret'
  ) => {
    let fixture = await loadOrganizationFixture({
      ...org.ids,
      instanceId: input.instanceId ?? org.ids.instanceId
    });
    let name = uniqueId('instance-key');

    let created = await apiKeyService.createApiKey({
      type,
      organization: fixture.organization,
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      input: { name, expiresAt: input.expiresAt, ipFilters: input.ipFilters }
    });

    return { fixture, name, ...created };
  };

  let createManagementKey = async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let name = uniqueId('management-key');

    let created = await apiKeyService.createApiKey({
      type: 'organization_management_token',
      organization: fixture.organization,
      auditScope: fixture.auditScope,
      input: { name }
    });

    return { fixture, name, ...created };
  };

  let authenticate = (token: string) =>
    machineAccessAuthService.authenticateWithMachineAccessToken({
      token,
      context: testContext()
    });

  let instanceApi = (apiKey: string) =>
    rest(metorialEndpoints().api, { apiKey, version: API_VERSIONS.magnetar });

  let managementApi = (apiKey: string) => rest(metorialEndpoints().api, { apiKey });

  let listenToSecretRequests = (veto = false) => {
    let events: SecretRequestedEvent[] = [];

    cleanups.push(
      Fabric.listen('machine_access.secret.requested:before', async event => {
        events.push(event);
        if (veto) {
          throw new ServiceError(forbiddenError({ message: 'Elevation required' }));
        }
      })
    );

    return events;
  };

  let expectRevealWindow = (canRevealUntil: Date | null) => {
    expect(canRevealUntil).toBeInstanceOf(Date);
    let remaining = canRevealUntil!.getTime() - Date.now();
    expect(remaining).toBeGreaterThan(4 * 60_000);
    expect(remaining).toBeLessThanOrEqual(5 * 60_000);
  };

  it('creates production instance secret keys with a five minute reveal window', async () => {
    let { apiKey, secret, name } = await createInstanceKey();

    expect(apiKey).toMatchObject({
      type: 'instance_access_token_secret',
      status: 'active',
      kind: 'user_created',
      name,
      canRevealForever: false
    });
    expectRevealWindow(apiKey.canRevealUntil);
    expect(apiKey.secretRedacted).not.toBe(secret.secret);
    expect(apiKey.secretLength).toBe(secret.secret.length);
    expect(apiKey.machineAccess).toMatchObject({
      type: 'instance_secret',
      status: 'active',
      name: `INSTANCE TOKEN ${name}`
    });
    expect(apiKey.machineAccess.instance?.id).toBe(org.ids.instanceId);

    let secrets = await db.apiKeySecret.findMany({ where: { apiKeyOid: apiKey.oid } });
    expect(secrets.map(row => row.id)).toEqual([secret.id]);
    expect(secrets[0]!.expiresAt).toBeNull();
    expect(secrets[0]!.secretSha512).not.toBe(secret.secret);

    let instance = expectOk(await instanceApi(secret.secret).get('/instance'));
    expect(instance.id).toBe(org.ids.instanceId);
    expect(
      (await db.apiKey.findUniqueOrThrow({ where: { oid: apiKey.oid } })).lastUsedAt
    ).toBeInstanceOf(Date);
  });

  it('reveals secrets only inside the reveal window', async () => {
    let { apiKey, secret, fixture } = await createInstanceKey();

    let revealed = await apiKeyService.revealApiKey({
      apiKey,
      auditScope: fixture.auditScope
    });
    expect(revealed.secret).toBe(secret.secret);

    await db.apiKey.update({
      where: { oid: apiKey.oid },
      data: { canRevealUntil: new Date(Date.now() - 1_000) }
    });
    let expired = await apiKeyService.getApiKeyById({
      apiKeyId: apiKey.id,
      organization: fixture.organization
    });

    let error = await expectServiceError(
      apiKeyService.revealApiKey({ apiKey: expired, auditScope: fixture.auditScope }),
      'forbidden'
    );
    expect(error.message).toMatch(/Cannot reveal/);
  });

  it('reveals publishable keys and development secret keys forever', async () => {
    let publishable = await createInstanceKey({}, 'instance_access_token_publishable');
    expect(publishable.apiKey).toMatchObject({
      type: 'instance_access_token_publishable',
      canRevealForever: true,
      canRevealUntil: null
    });
    expect(publishable.apiKey.machineAccess.type).toBe('instance_publishable');

    let auth = await authenticate(publishable.secret.secret);
    expect(auth.type).toBe('api_key');

    let sandbox = expectOk(
      await org.clients.management.post('/organization/sandboxes', {
        name: uniqueId('sandbox'),
        project_id: org.ids.projectId
      })
    );
    let development = await createInstanceKey({ instanceId: sandbox.instance.id });
    expect(development.apiKey.machineAccess.instance?.type).toBe('development');
    expect(development.apiKey).toMatchObject({ canRevealForever: true, canRevealUntil: null });

    await db.apiKey.update({
      where: { oid: development.apiKey.oid },
      data: { canRevealUntil: new Date(Date.now() - 1_000) }
    });
    let revealed = await apiKeyService.revealApiKey({
      apiKey: await apiKeyService.getApiKeyById({
        apiKeyId: development.apiKey.id,
        organization: development.fixture.organization
      }),
      auditScope: development.fixture.auditScope
    });
    expect(revealed.secret).toBe(development.secret.secret);
  });

  it('creates organization management tokens that authenticate the management API', async () => {
    let { apiKey, secret, name } = await createManagementKey();

    expect(apiKey).toMatchObject({
      type: 'organization_management_token',
      status: 'active',
      canRevealForever: false
    });
    expectRevealWindow(apiKey.canRevealUntil);
    expect(apiKey.machineAccess).toMatchObject({
      type: 'organization_management',
      name: `ORG TOKEN ${name}`,
      instance: null
    });
    expect(apiKey.machineAccess.organization?.id).toBe(org.ids.organizationId);

    let organization = expectOk(await managementApi(secret.secret).get('/organization'));
    expect(organization.id).toBe(org.ids.organizationId);
  });

  it('sends the created email to the organization admins', async () => {
    let { apiKey } = await createInstanceKey();

    await eventually(
      async () => {
        let send = await db.apiKeyCreatedEmailSend.findFirst({
          where: { apiKeyOid: apiKey.oid, email: org.user.email }
        });
        if (!send) throw new Error(`No created email for ${apiKey.id} yet`);
      },
      { timeoutMs: 60_000, intervalMs: 500 }
    );
  });

  it('lists keys by type and instance', async () => {
    let management = await createManagementKey();
    let secretKey = await createInstanceKey();
    let publishable = await createInstanceKey({}, 'instance_access_token_publishable');
    let { fixture } = management;

    let managementKeys = await firstPage(
      await apiKeyService.listApiKeys({
        filter: { type: 'organization_management_token', organization: fixture.organization }
      })
    );
    let managementIds = managementKeys.map(key => key.id);
    expect(managementIds).toContain(management.apiKey.id);
    expect(managementIds).not.toContain(secretKey.apiKey.id);
    expect(managementKeys.every(key => key.type == 'organization_management_token')).toBe(
      true
    );

    let instanceKeys = await firstPage(
      await apiKeyService.listApiKeys({
        filter: {
          type: 'instance_access_token',
          instance: fixture.instance,
          organization: fixture.organization
        }
      })
    );
    let instanceIds = instanceKeys.map(key => key.id);
    expect(instanceIds).toEqual(
      expect.arrayContaining([secretKey.apiKey.id, publishable.apiKey.id])
    );
    expect(instanceIds).not.toContain(management.apiKey.id);

    let otherFixture = await loadOrganizationFixture(otherOrg.ids);
    let foreign = await firstPage(
      await apiKeyService.listApiKeys({
        filter: {
          type: 'instance_access_token',
          instance: fixture.instance,
          organization: otherFixture.organization
        }
      })
    );
    expect(foreign).toEqual([]);
  });

  it('updates names, descriptions and ip filters without touching other fields', async () => {
    let { apiKey, name, fixture } = await createInstanceKey();

    let described = await apiKeyService.updateApiKey({
      apiKey,
      auditScope: fixture.auditScope,
      input: { description: 'Only the description' }
    });
    expect(described).toMatchObject({ name, description: 'Only the description' });
    expect(
      (await db.machineAccess.findUniqueOrThrow({ where: { oid: apiKey.machineAccessOid } }))
        .name
    ).toBe(`INSTANCE TOKEN ${name}`);

    let renamed = uniqueId('renamed');
    let filtered = await apiKeyService.updateApiKey({
      apiKey: described,
      auditScope: fixture.auditScope,
      input: { name: renamed, ipFilters: [' 10.0.0.1 ', '10.0.0.0/24', '10.0.0.1', ' '] }
    });
    expect(filtered.name).toBe(renamed);
    expect(filtered.ipFilters).toEqual(['10.0.0.1', '10.0.0.0/24']);
    expect(
      (await db.machineAccess.findUniqueOrThrow({ where: { oid: apiKey.machineAccessOid } }))
        .name
    ).toBe(`INSTANCE TOKEN ${renamed}`);

    await expectServiceError(
      apiKeyService.updateApiKey({
        apiKey: filtered,
        auditScope: fixture.auditScope,
        input: { ipFilters: ['10.0.0.0/33'] }
      }),
      'bad_request'
    );
    expect(
      (await db.apiKey.findUniqueOrThrow({ where: { oid: apiKey.oid } })).ipFilters
    ).toEqual(['10.0.0.1', '10.0.0.0/24']);
  });

  it('rejects invalid ip filters on create', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let name = uniqueId('invalid-filters');

    for (let ipFilter of [
      'not-an-ip',
      '10.0.0.0/33',
      '::/129',
      '10.0.0.1/abc',
      '1.2.3.4/8/9'
    ]) {
      let error = await expectServiceError(
        apiKeyService.createApiKey({
          type: 'instance_access_token_secret',
          organization: fixture.organization,
          instance: fixture.instance,
          auditScope: fixture.auditScope,
          input: { name, ipFilters: ['10.0.0.1', ipFilter] }
        }),
        'bad_request'
      );
      expect(error.message).toContain(ipFilter);
    }

    expect(await db.apiKey.count({ where: { name } })).toBe(0);
  });

  it('enforces ip filters when authenticating over REST', async () => {
    let blocked = await createInstanceKey({ ipFilters: ['203.0.113.7'] });
    let open = await createInstanceKey({ ipFilters: ['0.0.0.0/0', '::/0'] });

    let error = await instanceApi(blocked.secret.secret).get('/instance');
    expect(error.status).toBe(401);
    expect(error.body.message).toMatch(/IP address/);

    expectOk(await instanceApi(open.secret.secret).get('/instance'));

    await apiKeyService.updateApiKey({
      apiKey: blocked.apiKey,
      auditScope: blocked.fixture.auditScope,
      input: { ipFilters: [] }
    });
    await eventually(async () => {
      expectOk(await instanceApi(blocked.secret.secret).get('/instance'));
    });
  });

  it('keeps keys revealable and rotatable after their expiry changes', async () => {
    let { apiKey, secret, fixture } = await createInstanceKey();
    let expiresAt = new Date(Date.now() + 24 * 60 * 60_000);

    let updated = await apiKeyService.updateApiKey({
      apiKey,
      auditScope: fixture.auditScope,
      input: { expiresAt }
    });
    expect(updated.expiresAt?.getTime()).toBe(expiresAt.getTime());
    expect(
      (
        await db.apiKeySecret.findUniqueOrThrow({ where: { id: secret.id } })
      ).expiresAt?.getTime()
    ).toBe(expiresAt.getTime());

    let revealed = await apiKeyService.revealApiKey({
      apiKey: updated,
      auditScope: fixture.auditScope
    });
    expect(revealed.secret).toBe(secret.secret);

    let rotated = await apiKeyService.rotateApiKey({
      apiKey: updated,
      auditScope: fixture.auditScope,
      input: {}
    });
    expect(rotated.secret.expiresAt?.getTime()).toBe(expiresAt.getTime());
    await expect(authenticate(secret.secret)).rejects.toThrow(/expired or has been revoked/);
    expect((await authenticate(rotated.secret.secret)).type).toBe('api_key');
  });

  it('keeps the previous secret valid until the grace period of a rotation ends', async () => {
    let { apiKey, secret, fixture } = await createInstanceKey();
    let graceUntil = new Date(Date.now() + 60 * 60_000);

    await db.apiKey.update({
      where: { oid: apiKey.oid },
      data: { canRevealUntil: new Date(Date.now() - 1_000) }
    });
    let current = await apiKeyService.getApiKeyById({
      apiKeyId: apiKey.id,
      organization: fixture.organization
    });

    let rotated = await apiKeyService.rotateApiKey({
      apiKey: current,
      auditScope: fixture.auditScope,
      input: { currentExpiresAt: graceUntil }
    });
    expect(rotated.secret.secret).not.toBe(secret.secret);
    expect(rotated.apiKey.secretRedacted).not.toBe(apiKey.secretRedacted);
    expectRevealWindow(rotated.apiKey.canRevealUntil);

    expect(
      (
        await db.apiKeySecret.findUniqueOrThrow({ where: { id: secret.id } })
      ).expiresAt?.getTime()
    ).toBe(graceUntil.getTime());
    expect((await authenticate(secret.secret)).type).toBe('api_key');
    expect((await authenticate(rotated.secret.secret)).type).toBe('api_key');

    let revealed = await apiKeyService.revealApiKey({
      apiKey: rotated.apiKey,
      auditScope: fixture.auditScope
    });
    expect(revealed.id).toBe(rotated.secret.id);
  });

  it('revokes keys so they stop authenticating and reject further changes', async () => {
    let { apiKey, secret, fixture } = await createManagementKey();
    expectOk(await managementApi(secret.secret).get('/organization'));

    let revoked = await apiKeyService.revokeApiKey({ apiKey, auditScope: fixture.auditScope });
    expect(revoked.status).toBe('deleted');
    expect(revoked.deletedAt).toBeInstanceOf(Date);
    expect(
      (await db.machineAccess.findUniqueOrThrow({ where: { oid: apiKey.machineAccessOid } }))
        .status
    ).toBe('deleted');

    await expect(authenticate(secret.secret)).rejects.toThrow(/expired or has been revoked/);
    await eventually(async () => {
      expect((await managementApi(secret.secret).get('/organization')).status).toBe(401);
    });

    let auditScope = fixture.auditScope;
    await expectServiceError(
      apiKeyService.revokeApiKey({ apiKey: revoked, auditScope }),
      'forbidden'
    );
    await expectServiceError(
      apiKeyService.updateApiKey({ apiKey: revoked, auditScope, input: { name: 'x' } }),
      'forbidden'
    );
    await expectServiceError(
      apiKeyService.rotateApiKey({ apiKey: revoked, auditScope, input: {} }),
      'forbidden'
    );
    await expectServiceError(
      apiKeyService.revealApiKey({ apiKey: revoked, auditScope }),
      'forbidden'
    );

    let listed = await firstPage(
      await apiKeyService.listApiKeys({
        filter: { type: 'organization_management_token', organization: fixture.organization }
      })
    );
    expect(listed.map(key => key.id)).not.toContain(apiKey.id);
  });

  it('stops authenticating expired keys and marks them expired', async () => {
    let expired = await createInstanceKey({ expiresAt: new Date(Date.now() - 1_000) });
    let valid = await createInstanceKey({ expiresAt: new Date(Date.now() + 60 * 60_000) });

    await expect(authenticate(expired.secret.secret)).rejects.toThrow(
      /expired or has been revoked/
    );
    expect((await instanceApi(expired.secret.secret).get('/instance')).status).toBe(401);
    expectOk(await instanceApi(valid.secret.secret).get('/instance'));

    await eventually(
      async () => {
        let row = await db.apiKey.findUniqueOrThrow({ where: { oid: expired.apiKey.oid } });
        expect(row.status).toBe('expired');
      },
      { timeoutMs: 150_000, intervalMs: 2_000 }
    );
    expect(
      (await db.apiKey.findUniqueOrThrow({ where: { oid: valid.apiKey.oid } })).status
    ).toBe('active');

    let reloaded = await apiKeyService.getApiKeyById({
      apiKeyId: expired.apiKey.id,
      organization: expired.fixture.organization
    });
    await expectServiceError(
      apiKeyService.updateApiKey({
        apiKey: reloaded,
        auditScope: expired.fixture.auditScope,
        input: { name: 'x' }
      }),
      'forbidden'
    );
  }, 180_000);

  it('fires the secret verification hook with the dashboard session', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let session = await db.userSession.findFirstOrThrow({
      where: { user: { id: org.ids.userId } }
    });
    let verification = {
      token: 'e2e-verification-token',
      dashboardSession: {
        userId: org.ids.userId,
        sessionId: session.id,
        type: 'user' as const
      }
    };
    let events = listenToSecretRequests();

    let instanceKey = await apiKeyService.createApiKey({
      type: 'instance_access_token_secret',
      organization: fixture.organization,
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      verification,
      input: { name: uniqueId('verified') }
    });
    await apiKeyService.createApiKey({
      type: 'organization_management_token',
      organization: fixture.organization,
      auditScope: fixture.auditScope,
      verification,
      input: { name: uniqueId('verified') }
    });
    await createInstanceKey();

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ secretType: 'api_key', verification });
    expect(events[0]!.instance?.id).toBe(org.ids.instanceId);
    expect(events[0]!.auditScope?.organizationOid).toBe(fixture.organization.oid);
    expect(events[1]!.instance).toBeNull();

    await apiKeyService.revealApiKey({
      apiKey: instanceKey.apiKey,
      auditScope: fixture.auditScope,
      verification
    });
    await apiKeyService.rotateApiKey({
      apiKey: instanceKey.apiKey,
      auditScope: fixture.auditScope,
      verification,
      input: {}
    });
    expect(events).toHaveLength(4);
    expect(
      events.every(event => event.verification.dashboardSession?.sessionId == session.id)
    ).toBe(true);
  });

  it('lets the secret verification hook veto key creation and reveals', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let { apiKey, secret } = await createInstanceKey();
    let name = uniqueId('vetoed');
    let verification = { token: null, dashboardSession: null };
    listenToSecretRequests(true);

    await expectServiceError(
      apiKeyService.createApiKey({
        type: 'instance_access_token_secret',
        organization: fixture.organization,
        instance: fixture.instance,
        auditScope: fixture.auditScope,
        verification,
        input: { name }
      }),
      'forbidden'
    );
    expect(await db.apiKey.count({ where: { name } })).toBe(0);

    await expectServiceError(
      apiKeyService.revealApiKey({ apiKey, auditScope: fixture.auditScope, verification }),
      'forbidden'
    );
    await expectServiceError(
      apiKeyService.rotateApiKey({
        apiKey,
        auditScope: fixture.auditScope,
        verification,
        input: {}
      }),
      'forbidden'
    );
    expect((await authenticate(secret.secret)).type).toBe('api_key');
  });

  it('hides system internal keys from user-facing lookups', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let { apiKey } = await apiKeyService.createApiKey({
      type: 'instance_access_token_secret',
      kind: 'system_internal',
      organization: fixture.organization,
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      input: { name: uniqueId('internal') }
    });

    await expectServiceError(
      apiKeyService.getApiKeyById({ apiKeyId: apiKey.id, organization: fixture.organization }),
      'not_found'
    );
    await expectServiceError(
      apiKeyService.updateApiKey({
        apiKey,
        auditScope: fixture.auditScope,
        input: { name: 'x' }
      }),
      'forbidden'
    );

    let listed = await firstPage(
      await apiKeyService.listApiKeys({
        filter: {
          type: 'instance_access_token',
          instance: fixture.instance,
          organization: fixture.organization
        }
      })
    );
    expect(listed.map(key => key.id)).not.toContain(apiKey.id);
  });

  it('isolates keys between organizations', async () => {
    let { apiKey } = await createInstanceKey();
    let otherFixture = await loadOrganizationFixture(otherOrg.ids);

    await expectServiceError(
      apiKeyService.getApiKeyById({
        apiKeyId: apiKey.id,
        organization: otherFixture.organization
      }),
      'not_found'
    );
    await expectServiceError(
      apiKeyService.getApiKeyByIdForUser({ apiKeyId: apiKey.id, user: otherFixture.user }),
      'not_found'
    );

    let own = await apiKeyService.getApiKeyByIdForUser({
      apiKeyId: apiKey.id,
      user: (await loadOrganizationFixture(org.ids)).user
    });
    expect(own.id).toBe(apiKey.id);

    let otherKeys = await firstPage(
      await apiKeyService.listApiKeys({
        filter: {
          type: 'instance_access_token',
          instance: otherFixture.instance,
          organization: otherFixture.organization
        }
      })
    );
    expect(otherKeys.map(key => key.id)).not.toContain(apiKey.id);
  });
});
