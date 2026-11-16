import {
  expectServiceError,
  firstPage,
  testContext,
  uniqueId,
  useOrganization
} from '@metorial/e2e';
import { db, loadOrganizationFixture } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import {
  cliDeviceService,
  machineAccessAuthService,
  oauthApplicationService,
  oauthAuthorizationService,
  serviceAccountService
} from '../src';

describe('module-machine-access oauth applications and cli devices', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  let createApplication = async (
    input: {
      scopes?: string[];
      redirectUris?: string[];
      subjectType?: 'organization_member' | 'consumer';
    } = {},
    ids: { organizationId: string } = org.ids
  ) => {
    let fixture = await loadOrganizationFixture(ids);
    let name = uniqueId('oauth-app');

    let oauthApplication = await oauthApplicationService.createOAuthApplication({
      organization: fixture.organization,
      auditScope: fixture.auditScope,
      input: {
        type: 'user_facing',
        accessLevel: 'organization',
        subjectType: input.subjectType,
        name,
        description: 'E2E application',
        websiteUrl: 'https://example.com',
        redirectUris: input.redirectUris ?? ['https://example.com/callback'],
        scopes: input.scopes ?? ['organization:read']
      }
    });

    return { fixture, name, oauthApplication };
  };

  let authenticate = (token: string) =>
    machineAccessAuthService.authenticateWithMachineAccessToken({
      token,
      context: testContext()
    });

  let randomIp = () =>
    `10.${[0, 0, 0].map(() => Math.floor(Math.random() * 250) + 1).join('.')}`;

  let issueCliToken = async (ids: { organizationId: string }, ip: string) => {
    if (!(await oauthApplicationService.getCliAuthOAuthApplication())) {
      await oauthApplicationService.upsertCliAuthOAuthApplication();
    }

    let fixture = await loadOrganizationFixture(ids);
    let issued = await oauthAuthorizationService.issueCliAuthTokenForMember({
      organization: fixture.organization,
      member: fixture.member,
      context: { ip, ua: 'metorial-e2e-cli' }
    });

    return { fixture, ...issued };
  };

  it('creates organization-scoped applications with a scoped installation', async () => {
    let { oauthApplication, name, fixture } = await createApplication({
      redirectUris: ['https://example.com/callback', 'http://localhost:3000/callback'],
      scopes: ['organization:read', 'organization.member:read']
    });

    expect(oauthApplication).toMatchObject({
      status: 'active',
      type: 'user_facing',
      accessLevel: 'organization',
      subjectType: 'organization_member',
      allowClientSecretlessTokenExchange: false,
      name,
      description: 'E2E application',
      websiteUrl: 'https://example.com',
      redirectUris: ['https://example.com/callback', 'http://localhost:3000/callback'],
      scopes: ['organization.member:read', 'organization:read'],
      serverSideMachineAccess: null
    });
    expect(oauthApplication.clientId).toMatch(/^mt_oauth_/);
    expect(oauthApplication.organization?.id).toBe(org.ids.organizationId);
    expect(oauthApplication.scopedInstallation).toMatchObject({
      status: 'active',
      scopes: ['organization.member:read', 'organization:read'],
      serverSideMachineAccessOid: null
    });

    let fetched = await oauthApplicationService.getOAuthApplicationById({
      organization: fixture.organization,
      oauthApplicationId: oauthApplication.id
    });
    expect(fetched.scopedInstallation?.id).toBe(oauthApplication.scopedInstallation?.id);
  });

  it('filters applications by subject type and status', async () => {
    let member = await createApplication();
    let consumer = await createApplication({
      subjectType: 'consumer',
      scopes: ['consumer#organization:read']
    });
    expect(consumer.oauthApplication.subjectType).toBe('consumer');

    let organization = member.fixture.organization;
    let all = await firstPage(
      await oauthApplicationService.listOAuthApplications({ organization })
    );
    expect(all.map(item => item.id)).toEqual(
      expect.arrayContaining([member.oauthApplication.id, consumer.oauthApplication.id])
    );

    let consumers = await firstPage(
      await oauthApplicationService.listOAuthApplications({
        organization,
        subjectTypes: ['consumer']
      })
    );
    expect(consumers.map(item => item.id)).toContain(consumer.oauthApplication.id);
    expect(consumers.map(item => item.id)).not.toContain(member.oauthApplication.id);

    let archived = await firstPage(
      await oauthApplicationService.listOAuthApplications({
        organization,
        statuses: ['archived']
      })
    );
    expect(archived.map(item => item.id)).not.toContain(member.oauthApplication.id);
  });

  it('validates access levels, redirect uris and scopes', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let name = uniqueId('invalid-app');
    let create = (input: {
      type?: 'user_facing' | 'server_side';
      accessLevel?: 'organization' | 'global';
      redirectUris?: string[];
      scopes?: string[];
    }) =>
      oauthApplicationService.createOAuthApplication({
        organization: fixture.organization,
        auditScope: fixture.auditScope,
        input: {
          type: input.type ?? 'user_facing',
          accessLevel: input.accessLevel ?? 'organization',
          name,
          redirectUris: input.redirectUris,
          scopes: input.scopes ?? ['organization:read']
        }
      });

    await expectServiceError(
      create({ type: 'server_side', accessLevel: 'global' }),
      'forbidden'
    );
    for (let redirectUri of [
      'http://example.com/callback',
      'https://user:pass@example.com/callback',
      'not a uri'
    ]) {
      await expectServiceError(create({ redirectUris: [redirectUri] }), 'bad_request');
    }
    await expectServiceError(create({ scopes: ['organization:fly'] }), 'bad_request');
    await expectServiceError(
      create({ scopes: ['consumer#organization:read'] }),
      'bad_request'
    );

    expect(await db.oAuthApplication.count({ where: { name } })).toBe(0);
  });

  it('updates applications and their scoped installation', async () => {
    let { oauthApplication, fixture } = await createApplication();
    let name = uniqueId('renamed-app');

    let updated = await oauthApplicationService.updateOAuthApplication({
      oauthApplication,
      organization: fixture.organization,
      auditScope: fixture.auditScope,
      input: {
        name,
        description: null,
        websiteUrl: null,
        allowClientSecretlessTokenExchange: true,
        redirectUris: ['https://example.com/other'],
        scopes: ['organization:read', 'organization.member:read']
      }
    });
    expect(updated).toMatchObject({
      name,
      description: null,
      websiteUrl: null,
      allowClientSecretlessTokenExchange: true,
      redirectUris: ['https://example.com/other'],
      scopes: ['organization.member:read', 'organization:read']
    });
    expect(updated.scopedInstallation?.scopes).toEqual([
      'organization.member:read',
      'organization:read'
    ]);

    await expectServiceError(
      oauthApplicationService.updateOAuthApplication({
        oauthApplication: updated,
        organization: fixture.organization,
        auditScope: fixture.auditScope,
        input: { redirectUris: ['ftp://example.com'] }
      }),
      'bad_request'
    );
    expect(
      (await db.oAuthApplication.findUniqueOrThrow({ where: { oid: oauthApplication.oid } }))
        .redirectUris
    ).toEqual(['https://example.com/other']);
  });

  it('limits applications to 25 active client secrets', async () => {
    let { oauthApplication, fixture } = await createApplication();
    let create = () =>
      oauthApplicationService.createOAuthApplicationClientSecret({
        oauthApplication,
        auditScope: fixture.auditScope
      });

    let secrets = [];
    for (let i = 0; i < 25; i++) secrets.push(await create());
    expect(new Set(secrets.map(secret => secret.secret)).size).toBe(25);

    await expectServiceError(create(), 'forbidden');

    await oauthApplicationService.deleteOAuthApplicationClientSecret({
      oauthApplicationClientSecret: secrets[0]!,
      auditScope: fixture.auditScope
    });
    let replacement = await create();
    expect(replacement.deletedAt).toBeNull();

    await expectServiceError(
      oauthApplicationService.getOAuthApplicationClientSecretById({
        oauthApplication,
        oauthApplicationClientSecretId: secrets[0]!.id
      }),
      'not_found'
    );
  });

  it('archives applications and revokes their installations', async () => {
    let { oauthApplication, fixture } = await createApplication();
    let input = {
      oauthApplication,
      organization: fixture.organization,
      auditScope: fixture.auditScope
    };

    let archived = await oauthApplicationService.archiveOAuthApplication(input);
    expect(archived.status).toBe('archived');
    expect(
      (
        await db.oAuthInstallation.findUniqueOrThrow({
          where: { oid: oauthApplication.scopedInstallation!.oid }
        })
      ).status
    ).toBe('revoked');

    let archivedInput = { ...input, oauthApplication: archived };
    await expectServiceError(
      oauthApplicationService.updateOAuthApplication({
        ...archivedInput,
        input: { name: 'x' }
      }),
      'forbidden'
    );
    await expectServiceError(
      oauthApplicationService.archiveOAuthApplication(archivedInput),
      'forbidden'
    );
    await expectServiceError(
      oauthApplicationService.createOAuthApplicationClientSecret(archivedInput),
      'forbidden'
    );
    await expectServiceError(
      oauthAuthorizationService.getOAuthApplicationByClientId({
        clientId: oauthApplication.clientId
      }),
      'unauthorized'
    );

    let organization = fixture.organization;
    let active = await firstPage(
      await oauthApplicationService.listOAuthApplications({ organization })
    );
    expect(active.map(item => item.id)).not.toContain(oauthApplication.id);
    let archivedList = await firstPage(
      await oauthApplicationService.listOAuthApplications({
        organization,
        statuses: ['archived']
      })
    );
    expect(archivedList.map(item => item.id)).toContain(oauthApplication.id);
  });

  it('hides service account applications from the application lookups', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let serviceAccount = await serviceAccountService.createServiceAccount({
      organization: fixture.organization,
      auditScope: fixture.auditScope,
      input: { name: uniqueId('service-account'), scopes: ['organization:read'] }
    });

    await expectServiceError(
      oauthApplicationService.getOAuthApplicationById({
        organization: fixture.organization,
        oauthApplicationId: serviceAccount.oauthApplication.id
      }),
      'not_found'
    );

    let listed = await firstPage(
      await oauthApplicationService.listOAuthApplications({
        organization: fixture.organization
      })
    );
    expect(listed.map(item => item.id)).not.toContain(serviceAccount.oauthApplication.id);
  });

  it('isolates applications between organizations', async () => {
    let { oauthApplication } = await createApplication();
    let other = await createApplication({}, otherOrg.ids);
    let secret = await oauthApplicationService.createOAuthApplicationClientSecret({
      oauthApplication,
      auditScope: (await loadOrganizationFixture(org.ids)).auditScope
    });

    await expectServiceError(
      oauthApplicationService.getOAuthApplicationById({
        organization: other.fixture.organization,
        oauthApplicationId: oauthApplication.id
      }),
      'not_found'
    );
    await expectServiceError(
      oauthApplicationService.getOAuthApplicationClientSecretById({
        oauthApplication: other.oauthApplication,
        oauthApplicationClientSecretId: secret.id
      }),
      'not_found'
    );

    let otherList = await firstPage(
      await oauthApplicationService.listOAuthApplications({
        organization: other.fixture.organization
      })
    );
    expect(otherList.map(item => item.id)).toContain(other.oauthApplication.id);
    expect(otherList.map(item => item.id)).not.toContain(oauthApplication.id);
  });

  it('tracks one cli device per user and ip', async () => {
    let ip = randomIp();
    let otherIp = randomIp();
    let first = await issueCliToken(org.ids, ip);
    let second = await issueCliToken(org.ids, ip);
    await issueCliToken(org.ids, otherIp);
    let organization = first.fixture.organization;

    let devices = await firstPage(await cliDeviceService.listCliDevices({ organization }));
    let atIp = devices.filter(device => device.ip == ip);
    expect(atIp).toHaveLength(1);
    expect(atIp[0]!.user.id).toBe(org.ids.userId);
    expect(atIp[0]!.oauthAuthorization.id).toBe(second.oauthAuthorization.id);
    expect(devices.filter(device => device.ip == otherIp)).toHaveLength(1);

    let fetched = await cliDeviceService.getCliDeviceById({
      organization,
      cliDeviceId: atIp[0]!.id
    });
    expect(fetched.ip).toBe(ip);
    expect(first.oauthAuthorization).toMatchObject({ status: 'active' });
    expect(first.oauthApplication.type).toBe('cli_auth');

    let otherFixture = await loadOrganizationFixture(otherOrg.ids);
    await expectServiceError(
      cliDeviceService.getCliDeviceById({
        organization: otherFixture.organization,
        cliDeviceId: atIp[0]!.id
      }),
      'not_found'
    );
    let otherDevices = await firstPage(
      await cliDeviceService.listCliDevices({ organization: otherFixture.organization })
    );
    expect(otherDevices.map(device => device.id)).not.toContain(atIp[0]!.id);
  });

  it('stops authenticating cli tokens once their authorization is revoked', async () => {
    let { oauthToken, oauthAuthorization, fixture } = await issueCliToken(org.ids, randomIp());

    let auth = await authenticate(oauthToken.accessToken);
    expect(auth.type).toBe('oauth_token');
    if (auth.type != 'oauth_token') return;
    expect(auth.oauthToken.oauthAuthorization.user?.id).toBe(org.ids.userId);

    let revoked = await oauthAuthorizationService.revokeOAuthAuthorization({
      oauthAuthorization,
      auditScope: fixture.auditScope
    });
    expect(revoked.status).toBe('revoked');
    expect(revoked.revokedAt).toBeInstanceOf(Date);

    await expect(authenticate(oauthToken.accessToken)).rejects.toThrow(
      /expired or has been revoked/
    );
  });
});
