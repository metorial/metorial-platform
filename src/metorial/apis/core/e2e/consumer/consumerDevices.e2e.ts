import {
  API_VERSIONS,
  bootstrapUser,
  eventually,
  expectAuthMatrix,
  expectError,
  expectOk,
  expectPresented,
  listAll,
  metorialEndpoints,
  rest,
  testContext,
  uniqueEmail,
  uniqueId,
  useOrganization,
  type BootstrappedOrganization
} from '@metorial/e2e';
import { db, loadOrganizationFixture } from '@metorial/e2e/db';
import { ID } from '@metorial/db';
import {
  oauthApplicationService,
  oauthAuthorizationService
} from '@metorial/module-machine-access';
import { describe, expect, it } from 'vitest';
import {
  agentTrackingPath,
  claudeRequest,
  expectIngested,
  sendClaudeCodeRequests,
  serviceSessions,
  trackedConsumer,
  trackedDevice
} from '@metorial/agent-tracking-e2e';
import {
  createConsumerProfile,
  createPortal,
  crossTenantClients,
  ids,
  instancePathFor,
  startConsumerSession
} from './_shared';

let deviceScopePrefix = 'consumer#instance.device:';

let clients = [
  { key: 'cursor', name: 'Cursor', detected: true, installable: true, supports_skills: true },
  { key: 'vscode', name: 'VS Code', detected: true, installable: true, supports_skills: false }
];

let checkInBody = (overrides: Record<string, unknown> = {}) => ({
  installation_id: uniqueId('installation-0123456789'),
  name: 'E2E MacBook',
  os: 'macos',
  arch: 'aarch64',
  app_version: '0.2.0',
  clients,
  ...overrides
});

let signInDesktop = async (org: BootstrappedOrganization, portalId: string) => {
  let email = uniqueEmail('desktop');
  let user = await db.user.findUniqueOrThrow({
    where: { id: (await bootstrapUser({ email })).id }
  });
  let profile = await createConsumerProfile(org, portalId, { email });
  let consumerProfile = await db.consumerProfile.findUniqueOrThrow({
    where: { id: profile.id }
  });
  await db.consumer.update({
    where: { oid: consumerProfile.consumerOid },
    data: { userOid: user.oid }
  });

  if (!(await oauthApplicationService.getCliAuthOAuthApplication())) {
    await oauthApplicationService.upsertCliAuthOAuthApplication();
  }

  let request = await oauthAuthorizationService.createCliAuthAuthorizationRequest({
    context: testContext(),
    subjectType: 'consumer'
  });
  await oauthAuthorizationService.acceptOAuthAuthorizationRequest({
    oauthAuthorizationRequest: request,
    user,
    organizationId: org.ids.organizationId,
    consumerProfileId: profile.id,
    context: testContext()
  });
  let exchanged = await oauthAuthorizationService.exchangeCliAuthToken({
    token: request.deviceCode!
  });

  return {
    profile,
    oauthToken: exchanged.oauthToken,
    client: rest(metorialEndpoints().api, {
      apiKey: exchanged.oauthToken.accessToken,
      version: API_VERSIONS.magnetar
    })
  };
};

let dropDeviceScopes = async (oauthToken: { oauthAuthorizationOid: bigint }) => {
  let authorization = await db.oAuthAuthorization.findUniqueOrThrow({
    where: { oid: oauthToken.oauthAuthorizationOid },
    include: { machineAccess: true }
  });
  let keep = (scopes: string[]) =>
    scopes.filter(scope => !scope.startsWith(deviceScopePrefix));

  await db.oAuthAuthorization.update({
    where: { oid: authorization.oid },
    data: { scopes: keep(authorization.scopes) }
  });
  if (authorization.machineAccess) {
    await db.machineAccess.update({
      where: { oid: authorization.machineAccess.oid },
      data: { scopes: keep(authorization.machineAccess.scopes) }
    });
  }
};

describe('api-core consumer: devices', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  it('enrolls only from a desktop sign-in that has the device scopes', async () => {
    let portal = await createPortal(org);
    let desktop = await signInDesktop(org, portal.id);
    let unscoped = await signInDesktop(org, portal.id);
    await dropDeviceScopes(unscoped.oauthToken);
    let portalSession = await startConsumerSession(portal.id, desktop.profile);

    await expectAuthMatrix(
      {
        none: rest(metorialEndpoints().api, { version: API_VERSIONS.magnetar }),
        desktop: desktop.client,
        unscoped: unscoped.client,
        portalSession: portalSession.magnetar
      },
      client => client.post('/consumer/devices/check-in', checkInBody()),
      { none: 401, desktop: 200, unscoped: 403, portalSession: 412 }
    );
  });

  it('validates the check-in and the per-tool settings', async () => {
    let portal = await createPortal(org);
    let desktop = await signInDesktop(org, portal.id);
    let body = checkInBody();
    let device = expectOk(await desktop.client.post('/consumer/devices/check-in', body));

    expectError(
      await desktop.client.post(
        '/consumer/devices/check-in',
        checkInBody({ installation_id: 'short' })
      ),
      400,
      'invalid_data'
    );
    expectError(
      await desktop.client.post(
        '/consumer/devices/check-in',
        checkInBody({ clients: [{ ...clients[0], key: 'Not A Key' }] })
      ),
      400,
      'invalid_data'
    );
    expectError(
      await desktop.client.post(
        '/consumer/devices/check-in',
        checkInBody({
          clients: [{ key: 'cursor', name: 'Cursor', detected: true, installable: true }]
        })
      ),
      400,
      'invalid_data'
    );

    expectError(
      await desktop.client.post(
        '/consumer/devices/check-in',
        checkInBody({
          magic_mcp_token_ids: Array.from({ length: 201 }, (_, i) => `mgtk_${i}`)
        })
      ),
      400,
      'invalid_data'
    );
    expectOk(
      await desktop.client.post(
        '/consumer/devices/check-in',
        checkInBody({
          installation_id: body.installation_id,
          magic_mcp_token_ids: [uniqueId('mgtk_unknown')]
        })
      )
    );

    expectError(
      await desktop.client.patch(`/consumer/devices/${device.id}/clients/cursor`, {
        excluded_skill_ids: ['x'.repeat(200)]
      }),
      400,
      'invalid_data'
    );
    expectError(
      await desktop.client.patch(`/consumer/devices/${device.id}/clients/not-a-tool`, {
        enabled: false
      }),
      404,
      'not_found'
    );
  });

  it('presents each reported tool with what it receives and never the sign-in', async () => {
    let portal = await createPortal(org);
    let desktop = await signInDesktop(org, portal.id);
    let device = expectOk(
      await desktop.client.post('/consumer/devices/check-in', checkInBody())
    );

    expectPresented(device, 'consumer.device');
    expect(device).toMatchObject({
      status: 'active',
      consumer_profile_id: desktop.profile.id,
      revoked_at: null
    });
    expect(device.clients).toEqual([
      expect.objectContaining({
        object: 'consumer.device.client',
        key: 'cursor',
        supports_skills: true,
        enabled: true,
        excluded_magic_mcp_server_ids: [],
        excluded_skill_ids: []
      }),
      expect.objectContaining({ key: 'vscode', supports_skills: false })
    ]);

    let fixture = await loadOrganizationFixture(org.ids);
    let skill = await db.skill.create({
      data: {
        id: await ID.generateId('skill'),
        name: uniqueId('device-skill'),
        storeId: uniqueId('store'),
        skillEntityId: uniqueId('entity'),
        organizationOid: fixture.organization.oid,
        projectOid: fixture.project.oid,
        instanceOid: fixture.instance.oid
      }
    });
    let server = await db.magicMcpServer.create({
      data: {
        id: await ID.generateId('magicMcpServer'),
        status: 'active',
        instanceOid: fixture.instance.oid,
        metadata: {}
      }
    });

    let updated = expectOk(
      await desktop.client.patch(`/consumer/devices/${device.id}/clients/cursor`, {
        enabled: false,
        excluded_magic_mcp_server_ids: [server.id, uniqueId('mgsr_unknown')],
        excluded_skill_ids: [skill.id, skill.id, uniqueId('skl_unknown')]
      })
    );
    expect(updated.clients[0]).toMatchObject({
      key: 'cursor',
      enabled: false,
      excluded_magic_mcp_server_ids: [server.id],
      excluded_skill_ids: [skill.id]
    });

    let serialized = JSON.stringify(updated);
    expect(serialized).not.toContain(desktop.oauthToken.accessToken);
    expect(serialized).not.toContain(desktop.oauthToken.refreshToken!);
  });

  it('keeps devices to the consumer profile that enrolled them', async () => {
    let portal = await createPortal(org);
    let desktop = await signInDesktop(org, portal.id);
    let neighbour = await signInDesktop(org, portal.id);
    let device = expectOk(
      await desktop.client.post('/consumer/devices/check-in', checkInBody())
    );
    let portalSession = await startConsumerSession(portal.id, desktop.profile);

    expect(ids(await listAll(desktop.client, '/consumer/devices'))).toEqual([device.id]);
    expect(ids(await listAll(portalSession.magnetar, '/consumer/devices'))).toEqual([
      device.id
    ]);
    expect(await listAll(neighbour.client, '/consumer/devices')).toEqual([]);

    expectError(await neighbour.client.get(`/consumer/devices/${device.id}`), 404);
    expectError(
      await neighbour.client.patch(`/consumer/devices/${device.id}/clients/cursor`, {
        enabled: false
      }),
      404
    );
    expectError(await neighbour.client.post(`/consumer/devices/${device.id}/revoke`), 404);
  });

  it('signs out the requesting device and revokes others from the portal', async () => {
    let portal = await createPortal(org);
    let desktop = await signInDesktop(org, portal.id);
    let laptop = await signInDesktop(org, portal.id);
    let device = expectOk(
      await desktop.client.post('/consumer/devices/check-in', checkInBody())
    );
    let portalSession = await startConsumerSession(portal.id, desktop.profile);

    let revoked = expectOk(
      await portalSession.magnetar.post(`/consumer/devices/${device.id}/revoke`)
    );
    expect(revoked).toMatchObject({ id: device.id, status: 'revoked' });
    expectError(await desktop.client.get('/consumer/devices'), 401);
    expect(await listAll(portalSession.magnetar, '/consumer/devices')).toEqual([]);
    expect(
      ids(
        await listAll(portalSession.magnetar, '/consumer/devices', {
          query: { status: 'revoked' }
        })
      )
    ).toEqual([device.id]);

    let laptopDevice = expectOk(
      await laptop.client.post('/consumer/devices/check-in', checkInBody())
    );
    let signedOut = expectOk(await laptop.client.post('/consumer/devices/sign-out'));
    expect(signedOut).toMatchObject({ id: laptopDevice.id, status: 'signed_out' });
    expectError(await laptop.client.post('/consumer/devices/sign-out'), 401);
  });

  it('issues a telemetry token bound to the device only to its own consumer', async () => {
    let portal = await createPortal(org);
    let desktop = await signInDesktop(org, portal.id);
    let neighbour = await signInDesktop(org, portal.id);
    let device = expectOk(
      await desktop.client.post('/consumer/devices/check-in', checkInBody())
    );

    let foreign = expectError(
      await neighbour.client.post(`/consumer/devices/${device.id}/telemetry-token`),
      404,
      'not_found'
    );
    expect(foreign.entity).toBe('consumer.device');

    let issued = expectPresented(
      expectOk(await desktop.client.post(`/consumer/devices/${device.id}/telemetry-token`)),
      'consumer.device.telemetry_token'
    );
    expect(issued).toMatchObject({ consumer_device_id: device.id, expires_at: null });
    expect(issued.token.startsWith('metorial_agit_')).toBe(true);
    expect(typeof issued.ingest_url).toBe('string');

    let rows = await db.agentTrackingIngestToken.findMany({
      where: { consumerDevice: { id: device.id } }
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      status: 'active',
      deviceMode: 'bound',
      serviceIngestTokenId: issued.token_id
    });
    expect(
      JSON.stringify(rows[0], (_, value) => (typeof value == 'bigint' ? `${value}` : value))
    ).not.toContain(issued.token);
  });

  it('attributes usage sent with the telemetry token to the consumer and the device', async () => {
    let portal = await createPortal(org);
    let desktop = await signInDesktop(org, portal.id);
    let device = expectOk(
      await desktop.client.post('/consumer/devices/check-in', checkInBody())
    );
    let issued = expectOk(
      await desktop.client.post(`/consumer/devices/${device.id}/telemetry-token`)
    );
    let { consumer } = await db.consumerProfile.findUniqueOrThrow({
      where: { id: desktop.profile.id },
      include: { consumer: true }
    });

    await expectIngested(
      await sendClaudeCodeRequests({ ingestUrl: issued.ingest_url, secret: issued.token }, [
        claudeRequest()
      ])
    );

    let user = await trackedConsumer(org.ids, consumer.id);
    let deviceEntity = await trackedDevice(org.ids, device.id);

    await eventually(
      async () => {
        let sessions = await serviceSessions(org.ids);
        expect(
          sessions.some(
            session =>
              session.observed.userId == user.id &&
              session.observed.deviceId == deviceEntity.id
          )
        ).toBe(true);
      },
      { timeoutMs: 30_000, intervalMs: 500 }
    );

    let members = await eventually(
      async () => {
        let members = await listAll(org.clients.rest, agentTrackingPath(org, '/members'));
        expect(members.map(member => member.id)).toContain(user.id);

        return members;
      },
      { timeoutMs: 90_000, intervalMs: 5_000 }
    );
    expect(members.find(member => member.id == user.id)).toMatchObject({
      matched: true,
      consumer: { email: consumer.email }
    });
  }, 150_000);

  it('rotates the telemetry token and refuses the replaced one', async () => {
    let portal = await createPortal(org);
    let desktop = await signInDesktop(org, portal.id);
    let device = expectOk(
      await desktop.client.post('/consumer/devices/check-in', checkInBody())
    );
    let issue = async () =>
      expectOk(await desktop.client.post(`/consumer/devices/${device.id}/telemetry-token`));
    let send = (token: { ingest_url: string; token: string }) =>
      sendClaudeCodeRequests({ ingestUrl: token.ingest_url, secret: token.token }, [
        claudeRequest()
      ]);

    let replaced = await issue();
    let current = await issue();
    expect(current.token).not.toBe(replaced.token);

    await eventually(
      async () => {
        let previous = await db.agentTrackingIngestToken.findFirstOrThrow({
          where: { serviceIngestTokenId: replaced.token_id }
        });
        expect(previous.status).toBe('revoked');
      },
      { timeoutMs: 30_000, intervalMs: 500 }
    );
    await eventually(async () => expect((await send(replaced)).status).toBe(401), {
      timeoutMs: 30_000,
      intervalMs: 1_000
    });

    await expectIngested(await send(current));
  }, 90_000);

  it('lets admins list, read and revoke devices of their own instance', async () => {
    let portal = await createPortal(org);
    let desktop = await signInDesktop(org, portal.id);
    let device = expectOk(
      await desktop.client.post('/consumer/devices/check-in', checkInBody())
    );
    let tenants = crossTenantClients(org, otherOrg);

    await expectAuthMatrix(
      tenants,
      (client, name) =>
        client.get(instancePathFor(org, name, `/consumer-devices/${device.id}`)),
      {
        none: 401,
        session: 200,
        management: 200,
        instance: 200,
        otherSession: 404,
        otherManagement: 404,
        otherInstance: 404
      }
    );

    let listed = await listAll(org.clients.instance, '/consumer-devices', {
      query: { consumer_profile_id: desktop.profile.id },
      limit: 1
    });
    expect(ids(listed)).toEqual([device.id]);

    expectError(
      await otherOrg.clients.instance.post(`/consumer-devices/${device.id}/revoke`),
      404
    );

    let revoked = expectOk(
      await org.clients.instance.post(`/consumer-devices/${device.id}/revoke`)
    );
    expect(revoked.status).toBe('revoked');
    expectError(await org.clients.instance.post(`/consumer-devices/${device.id}/revoke`), 412);
  });
});
