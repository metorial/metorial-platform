import { ID, type ConsumerProfile, type User } from '@metorial/db';
import {
  expectServiceError,
  firstPage,
  testContext,
  uniqueEmail,
  uniqueId,
  useOrganization
} from '@metorial/e2e';
import { db, loadOrganizationFixture, type OrganizationFixture } from '@metorial/e2e/db';
import {
  machineAccessAuthService,
  oauthApplicationService,
  oauthAuthorizationService
} from '@metorial/module-machine-access';
import { magicMcpTokenService } from '@metorial/module-magic';
import { describe, expect, it } from 'vitest';
import { consumerDeviceService } from '../src';
import {
  captureFabric,
  createConsumerProfile,
  createPortalSurface,
  signUpUser
} from './_fixtures';

let reportedClients = [
  { key: 'cursor', name: 'Cursor', detected: true, installable: true, supportsSkills: true },
  { key: 'codex', name: 'Codex', detected: false, installable: false, supportsSkills: true }
];

let deviceInput = (installationId = uniqueId('installation-0123456789')) => ({
  installationId,
  name: 'E2E MacBook',
  os: 'macos',
  arch: 'aarch64',
  appVersion: '0.2.0',
  reportedClients
});

let createDesktopUser = async (fixture: OrganizationFixture) => {
  let email = uniqueEmail('desktop');
  let user = await signUpUser(email);
  let { surface } = await createPortalSurface(fixture);
  let consumerProfile = await createConsumerProfile(fixture, surface, { email });
  await db.consumer.update({
    where: { oid: consumerProfile.consumerOid },
    data: { userOid: user.oid }
  });

  return { user, consumerProfile };
};

let signInDesktop = async (
  fixture: OrganizationFixture,
  d: { user: User; consumerProfile: ConsumerProfile }
) => {
  if (!(await oauthApplicationService.getCliAuthOAuthApplication())) {
    await oauthApplicationService.upsertCliAuthOAuthApplication();
  }

  let request = await oauthAuthorizationService.createCliAuthAuthorizationRequest({
    context: testContext(),
    subjectType: 'consumer'
  });
  await oauthAuthorizationService.acceptOAuthAuthorizationRequest({
    oauthAuthorizationRequest: request,
    user: d.user,
    organizationId: fixture.organization.id,
    consumerProfileId: d.consumerProfile.id,
    context: testContext()
  });
  let exchanged = await oauthAuthorizationService.exchangeCliAuthToken({
    token: request.deviceCode!
  });

  return await authenticate(exchanged.oauthToken.accessToken);
};

let refreshSignIn = async (oauthToken: { oid: bigint }) => {
  let stored = await db.oAuthToken.findUniqueOrThrow({ where: { oid: oauthToken.oid } });
  let cliAuthApplication = await oauthApplicationService.getCliAuthOAuthApplication();

  return await oauthAuthorizationService.exchangeOAuthToken({
    context: testContext(),
    input: {
      grantType: 'refresh_token',
      clientId: cliAuthApplication!.clientId,
      refreshToken: stored.refreshToken!
    }
  });
};

let createInstallToken = async (
  fixture: OrganizationFixture,
  signedInOAuthToken?: { oid: bigint }
) =>
  await magicMcpTokenService.createMagicMcpToken({
    instance: fixture.instance,
    auditScope: fixture.auditScope,
    input: { name: uniqueId('install') },
    signedInOAuthToken
  });

let giveTokenTo = async <T extends { oid: bigint }>(
  consumerProfile: ConsumerProfile,
  token: T
) => {
  await db.consumerToken.create({
    data: {
      id: await ID.generateId('consumerToken'),
      instanceOid: consumerProfile.instanceOid,
      consumerOid: consumerProfile.consumerOid,
      consumerProfileOid: consumerProfile.oid,
      magicMcpTokenOid: token.oid
    }
  });

  return token;
};

let tokenDevice = async (token: { oid: bigint }) =>
  (await db.magicMcpToken.findUniqueOrThrow({ where: { oid: token.oid } })).consumerDeviceOid;

let tokenStatus = async (token: { oid: bigint }) =>
  (await db.magicMcpToken.findUniqueOrThrow({ where: { oid: token.oid } })).status;

let authenticate = async (accessToken: string) => {
  let auth = await machineAccessAuthService.authenticateWithMachineAccessToken({
    token: accessToken,
    context: testContext()
  });
  if (auth.type != 'oauth_token') throw new Error('Expected an OAuth token');

  return auth.oauthToken;
};

describe('module-consumer-core devices', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  let checkIn = (
    fixture: OrganizationFixture,
    desktop: { consumerProfile: ConsumerProfile },
    oauthToken: Awaited<ReturnType<typeof signInDesktop>> | undefined,
    input: Parameters<typeof consumerDeviceService.checkInDevice>[0]['input'] = deviceInput()
  ) =>
    consumerDeviceService.checkInDevice({
      instance: fixture.instance,
      consumerProfile: desktop.consumerProfile,
      oauthToken,
      auditScope: fixture.auditScope,
      input
    });

  it('enrolls a device on its first check-in and refreshes it on later ones', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let desktop = await createDesktopUser(fixture);
    let oauthToken = await signInDesktop(fixture, desktop);
    let input = deviceInput();
    let enrolled = captureFabric('consumer.device.enrolled:after');

    let first = await checkIn(fixture, desktop, oauthToken, input);
    let second = await checkIn(fixture, desktop, oauthToken, {
      ...input,
      appVersion: '0.2.1',
      name: 'Renamed MacBook'
    });
    enrolled.stop();

    expect(second.id).toBe(first.id);
    expect(enrolled.events.map(event => event.consumerDevice.id)).toEqual([first.id]);

    let stored = await db.consumerDevice.findUniqueOrThrow({ where: { oid: first.oid } });
    expect(stored).toMatchObject({
      status: 'active',
      oauthTokenOid: oauthToken.oid,
      name: 'Renamed MacBook',
      appVersion: '0.2.1',
      reportedClients
    });
    expect(stored.lastSeenAt.getTime()).toBeGreaterThanOrEqual(first.lastSeenAt.getTime());
  });

  it('enrolls one device when the first check-ins race', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let desktop = await createDesktopUser(fixture);
    let oauthToken = await signInDesktop(fixture, desktop);
    let input = deviceInput();

    let [a, b] = await Promise.all([
      checkIn(fixture, desktop, oauthToken, input),
      checkIn(fixture, desktop, oauthToken, input)
    ]);

    expect(a.id).toBe(b.id);
    expect(
      await db.consumerDevice.count({
        where: { consumerProfileOid: desktop.consumerProfile.oid }
      })
    ).toBe(1);
  });

  it('only enrolls devices from a desktop or CLI consumer sign-in', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let desktop = await createDesktopUser(fixture);
    let oauthToken = await signInDesktop(fixture, desktop);
    let authorization = oauthToken.oauthAuthorization;

    await expectServiceError(checkIn(fixture, desktop, undefined), 'precondition_failed');
    await expectServiceError(
      checkIn(fixture, desktop, {
        ...oauthToken,
        oauthAuthorization: {
          ...authorization,
          oauthApplication: { ...authorization.oauthApplication, type: 'user_facing' }
        }
      }),
      'precondition_failed'
    );
    await expectServiceError(
      checkIn(fixture, desktop, {
        ...oauthToken,
        oauthAuthorization: { ...authorization, subjectType: 'organization_member' }
      }),
      'precondition_failed'
    );
  });

  it('stores per-tool settings as exclusions for reported tools only', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let desktop = await createDesktopUser(fixture);
    let oauthToken = await signInDesktop(fixture, desktop);
    let device = await checkIn(fixture, desktop, oauthToken);
    expect(device.clientSettings).toEqual([]);

    let updated = await consumerDeviceService.updateClientSetting({
      consumerDevice: device,
      clientKey: 'cursor',
      auditScope: fixture.auditScope,
      input: { excludedMagicMcpServerIds: ['mms_a', 'mms_a', 'mms_b'] }
    });
    let disabled = await consumerDeviceService.updateClientSetting({
      consumerDevice: updated,
      clientKey: 'cursor',
      auditScope: fixture.auditScope,
      input: { enabled: false, excludedSkillIds: ['skl_a'] }
    });

    expect(disabled.clientSettings).toHaveLength(1);
    expect(disabled.clientSettings[0]).toMatchObject({
      clientKey: 'cursor',
      enabled: false,
      excludedMagicMcpServerIds: ['mms_a', 'mms_b'],
      excludedSkillIds: ['skl_a']
    });

    await expectServiceError(
      consumerDeviceService.updateClientSetting({
        consumerDevice: disabled,
        clientKey: 'not-a-tool',
        auditScope: fixture.auditScope,
        input: { enabled: false }
      }),
      'not_found'
    );
    expect(
      await db.consumerDeviceClientSetting.count({ where: { consumerDeviceOid: device.oid } })
    ).toBe(1);
  });

  it('links install tokens to the device of the sign-in that created them', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let desktop = await createDesktopUser(fixture);
    let oauthToken = await signInDesktop(fixture, desktop);
    let device = await checkIn(fixture, desktop, oauthToken);

    let linked = await createInstallToken(fixture, oauthToken);
    let unlinked = await createInstallToken(fixture);
    let otherSignIn = await createInstallToken(fixture, await signInDesktop(fixture, desktop));

    expect(linked.consumerDeviceOid).toBe(device.oid);
    expect(unlinked.consumerDeviceOid).toBeNull();
    expect(otherSignIn.consumerDeviceOid).toBeNull();
  });

  it("links the profile's own unlinked install tokens it reports", async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let desktop = await createDesktopUser(fixture);
    let neighbour = await createDesktopUser(fixture);
    let otherSignIn = await signInDesktop(fixture, desktop);
    let other = await checkIn(fixture, desktop, otherSignIn);

    let own = await giveTokenTo(desktop.consumerProfile, await createInstallToken(fixture));
    let neighbours = await giveTokenTo(
      neighbour.consumerProfile,
      await createInstallToken(fixture)
    );
    let elsewhere = await giveTokenTo(
      desktop.consumerProfile,
      await createInstallToken(fixture, otherSignIn)
    );
    let unowned = await createInstallToken(fixture);

    let device = await checkIn(fixture, desktop, await signInDesktop(fixture, desktop), {
      ...deviceInput(),
      magicMcpTokenIds: [
        own.id,
        neighbours.id,
        elsewhere.id,
        unowned.id,
        uniqueId('mgtk_unknown')
      ]
    });

    expect(await tokenDevice(own)).toBe(device.oid);
    expect(await tokenDevice(neighbours)).toBeNull();
    expect(await tokenDevice(elsewhere)).toBe(other.oid);
    expect(await tokenDevice(unowned)).toBeNull();
  });

  it('signs out only the device the request came from', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let desktop = await createDesktopUser(fixture);
    let laptopToken = await signInDesktop(fixture, desktop);
    let desktopToken = await signInDesktop(fixture, desktop);
    let laptop = await checkIn(fixture, desktop, laptopToken);
    let workstation = await checkIn(fixture, desktop, desktopToken);
    let installToken = await createInstallToken(fixture, laptopToken);
    let workstationToken = await createInstallToken(fixture, desktopToken);
    let ended = captureFabric('consumer.device.ended:after');

    let signedOut = await consumerDeviceService.signOutDevice({
      consumerProfile: desktop.consumerProfile,
      oauthToken: laptopToken,
      auditScope: fixture.auditScope
    });
    ended.stop();

    expect(signedOut).toMatchObject({ id: laptop.id, status: 'signed_out', revokedAt: null });
    expect(ended.events.map(event => event.consumerDevice.status)).toEqual(['signed_out']);
    await expect(authenticate(laptopToken.accessToken)).rejects.toThrow();
    expect((await authenticate(desktopToken.accessToken)).oid).toBe(desktopToken.oid);
    expect(await tokenStatus(installToken)).toBe('deleted');
    expect(await tokenStatus(workstationToken)).toBe('active');
    expect(
      (await db.consumerDevice.findUniqueOrThrow({ where: { oid: workstation.oid } })).status
    ).toBe('active');

    await expectServiceError(
      consumerDeviceService.signOutDevice({
        consumerProfile: desktop.consumerProfile,
        oauthToken: laptopToken,
        auditScope: fixture.auditScope
      }),
      'precondition_failed'
    );
  });

  it('revokes a device, deletes its install tokens and lets it sign in again', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let desktop = await createDesktopUser(fixture);
    let firstToken = await signInDesktop(fixture, desktop);
    let input = deviceInput();
    let device = await checkIn(fixture, desktop, firstToken, input);
    let installToken = await createInstallToken(fixture, firstToken);

    let revoked = await consumerDeviceService.revokeDevice({
      consumerDevice: device,
      auditScope: fixture.auditScope
    });
    expect(revoked.status).toBe('revoked');
    expect(revoked.revokedAt).toBeInstanceOf(Date);
    expect(await tokenStatus(installToken)).toBe('deleted');
    await expect(authenticate(firstToken.accessToken)).rejects.toThrow();
    await expectServiceError(
      consumerDeviceService.updateClientSetting({
        consumerDevice: revoked,
        clientKey: 'cursor',
        auditScope: fixture.auditScope,
        input: { enabled: false }
      }),
      'precondition_failed'
    );
    await expectServiceError(
      checkIn(fixture, desktop, firstToken, input),
      'precondition_failed'
    );

    let secondToken = await signInDesktop(fixture, desktop);
    let updated = captureFabric('consumer.device.updated:after');
    let again = await checkIn(fixture, desktop, secondToken, input);
    updated.stop();

    expect(again).toMatchObject({
      id: device.id,
      status: 'active',
      revokedAt: null,
      oauthTokenOid: secondToken.oid
    });
    expect(updated.events.map(event => event.previousConsumerDevice.status)).toEqual([
      'revoked'
    ]);
  });

  it('revokes a device only once when two revokes race', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let desktop = await createDesktopUser(fixture);
    let device = await checkIn(fixture, desktop, await signInDesktop(fixture, desktop));
    let ended = captureFabric('consumer.device.ended:after');

    let results = await Promise.allSettled([
      consumerDeviceService.revokeDevice({
        consumerDevice: device,
        auditScope: fixture.auditScope
      }),
      consumerDeviceService.revokeDevice({
        consumerDevice: device,
        auditScope: fixture.auditScope
      })
    ]);
    ended.stop();

    expect(results.filter(result => result.status == 'fulfilled')).toHaveLength(1);
    expect(ended.events).toHaveLength(1);
  });

  it('replaces an older sign-in of the same installation', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let desktop = await createDesktopUser(fixture);
    let oldToken = await signInDesktop(fixture, desktop);
    let newToken = await signInDesktop(fixture, desktop);
    let input = deviceInput();

    await checkIn(fixture, desktop, oldToken, input);
    let device = await checkIn(fixture, desktop, newToken, input);

    expect(device.oauthTokenOid).toBe(newToken.oid);
    await expect(authenticate(oldToken.accessToken)).rejects.toThrow();
  });

  it('moves a sign-in to a new installation and ends the device it left', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let desktop = await createDesktopUser(fixture);
    let oauthToken = await signInDesktop(fixture, desktop);
    let previous = await checkIn(fixture, desktop, oauthToken);
    let installToken = await createInstallToken(fixture, oauthToken);

    let moved = await checkIn(fixture, desktop, oauthToken);

    expect(moved.id).not.toBe(previous.id);
    expect(moved.oauthTokenOid).toBe(oauthToken.oid);
    expect(
      await db.consumerDevice.findUniqueOrThrow({ where: { oid: previous.oid } })
    ).toMatchObject({ status: 'signed_out', oauthTokenOid: null });
    expect(await tokenStatus(installToken)).toBe('deleted');
    expect((await authenticate(oauthToken.accessToken)).oid).toBe(oauthToken.oid);
  });

  it('ends every device when the shared sign-in authorization is revoked', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let desktop = await createDesktopUser(fixture);
    let laptopToken = await signInDesktop(fixture, desktop);
    let workstationToken = await signInDesktop(fixture, desktop);
    let laptop = await checkIn(fixture, desktop, laptopToken);
    let workstation = await checkIn(fixture, desktop, workstationToken);
    let installToken = await createInstallToken(fixture, workstationToken);

    await oauthAuthorizationService.revokeOAuthAuthorization({
      oauthAuthorization: laptopToken.oauthAuthorization,
      auditScope: fixture.auditScope
    });

    let devices = await db.consumerDevice.findMany({
      where: { oid: { in: [laptop.oid, workstation.oid] } }
    });
    expect(devices.map(device => device.status)).toEqual(['revoked', 'revoked']);
    expect(await tokenStatus(installToken)).toBe('deleted');

    await signInDesktop(fixture, desktop);
    await expect(authenticate(laptopToken.accessToken)).rejects.toThrow();
    await expect(authenticate(workstationToken.accessToken)).rejects.toThrow();
    await expect(refreshSignIn(laptopToken)).rejects.toThrow(/can no longer be refreshed/);
  });

  it('refreshes a sign-in only once when two refreshes race', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let desktop = await createDesktopUser(fixture);
    let oauthToken = await signInDesktop(fixture, desktop);

    let results = await Promise.allSettled([
      refreshSignIn(oauthToken),
      refreshSignIn(oauthToken)
    ]);

    expect(results.filter(result => result.status == 'fulfilled')).toHaveLength(1);
  });

  it('keeps devices to their consumer profile and instance', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let other = await loadOrganizationFixture(otherOrg.ids);
    let desktop = await createDesktopUser(fixture);
    let neighbour = await createDesktopUser(fixture);
    let device = await checkIn(fixture, desktop, await signInDesktop(fixture, desktop));

    await expectServiceError(
      consumerDeviceService.getDeviceById({
        instance: fixture.instance,
        consumerProfile: neighbour.consumerProfile,
        consumerDeviceId: device.id
      }),
      'not_found'
    );
    await expectServiceError(
      consumerDeviceService.getDeviceById({
        instance: other.instance,
        consumerDeviceId: device.id
      }),
      'not_found'
    );

    let own = await firstPage(
      await consumerDeviceService.listDevices({
        instance: fixture.instance,
        consumerProfileIds: [desktop.consumerProfile.id]
      })
    );
    let neighbours = await firstPage(
      await consumerDeviceService.listDevices({
        instance: fixture.instance,
        consumerProfileIds: [neighbour.consumerProfile.id]
      })
    );
    let otherInstance = await firstPage(
      await consumerDeviceService.listDevices({
        instance: other.instance,
        consumerProfileIds: [desktop.consumerProfile.id]
      })
    );

    expect(own.map(item => item.id)).toEqual([device.id]);
    expect(neighbours).toEqual([]);
    expect(otherInstance).toEqual([]);
  });

  it('lists active devices unless other statuses are asked for', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let desktop = await createDesktopUser(fixture);
    let device = await checkIn(fixture, desktop, await signInDesktop(fixture, desktop));
    await consumerDeviceService.revokeDevice({
      consumerDevice: device,
      auditScope: fixture.auditScope
    });

    let byDefault = await firstPage(
      await consumerDeviceService.listDevices({
        instance: fixture.instance,
        consumerProfileIds: [desktop.consumerProfile.id]
      })
    );
    let revoked = await firstPage(
      await consumerDeviceService.listDevices({
        instance: fixture.instance,
        consumerProfileIds: [desktop.consumerProfile.id],
        statuses: ['revoked']
      })
    );

    expect(byDefault).toEqual([]);
    expect(revoked.map(item => item.id)).toEqual([device.id]);
  });
});
