import {
  bootstrapMember,
  expectOk,
  expectServiceError,
  testContext,
  uniqueId,
  useMember,
  useOrganization,
  type BootstrappedOrganization
} from '@metorial/e2e';
import { db, loadOrganizationFixture } from '@metorial/e2e/db';
import { organizationMemberService } from '@metorial/module-organization';
import { describe, expect, it } from 'vitest';
import {
  accessService,
  assertResourceActorScope,
  assertResourceAuthorizationScope,
  authenticationService,
  createResourceAuthorization,
  sessionClientSecretReferenceService,
  type AuthInfo,
  type Scope
} from '../src';

describe('module-access organization and instance access', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();
  let member = useMember(org);

  let secondProject: Promise<{ projectId: string; instanceId: string }> | undefined;

  let createProject = async (target: BootstrappedOrganization) => {
    let base = `/dashboard/organizations/${target.ids.organizationId}`;
    let project = expectOk(
      await target.clients.rest.post(`${base}/projects`, { name: uniqueId('E2E Project') })
    );
    let instances = expectOk(
      await target.clients.rest.get(`${base}/instances`, { query: { project_id: project.id } })
    );

    return { projectId: project.id as string, instanceId: instances.items[0].id as string };
  };

  let getSecondProject = () => (secondProject ??= createProject(org));

  let authenticateSession = (sessionClientSecret: string) =>
    authenticationService.authenticate({
      type: 'user_session',
      sessionClientSecret,
      context: testContext()
    });

  let authenticateKey = (apiKey: string) =>
    authenticationService.authenticate({ type: 'api_key', apiKey, context: testContext() });

  let rejectsSync = (fn: () => unknown) => Promise.resolve().then(fn);

  it('resolves the organization and its instances for the owner by id and slug', async () => {
    let authInfo = await authenticateSession(org.session);
    let organization = await db.organization.findUniqueOrThrow({
      where: { id: org.ids.organizationId }
    });
    let instance = await db.instance.findUniqueOrThrow({ where: { id: org.ids.instanceId } });

    let byId = await accessService.accessOrganization({
      authInfo,
      organizationId: organization.id
    });
    expect(byId.type).toBe('user');
    expect(byId.member?.role).toBe('admin');
    expect(byId.actor.id).toBe(byId.member?.actor.id);

    let bySlug = await accessService.accessOrganization({
      authInfo,
      organizationId: organization.slug
    });
    expect(bySlug.organization.id).toBe(organization.id);

    let instanceById = await accessService.accessInstance({
      authInfo,
      instanceId: instance.id
    });
    expect(instanceById.organization.id).toBe(organization.id);
    expect(instanceById.type == 'user' && instanceById.member?.id).toBe(byId.member?.id);
    expect(instanceById.resourceActor?.projectOid).toBe(instance.projectOid);

    let instanceBySlug = await accessService.accessInstance({
      authInfo,
      instanceId: instance.slug
    });
    expect(instanceBySlug.instance.id).toBe(instance.id);
  });

  it('resolves non-admin members and hides the organization from everyone else', async () => {
    let memberAuth = await authenticateSession(member.user.session);

    let access = await accessService.accessOrganization({
      authInfo: memberAuth,
      organizationId: org.ids.organizationId
    });
    expect(access.member?.id).toBe(member.member.id);
    expect(access.member?.role).toBe('member');

    let instance = await accessService.accessInstance({
      authInfo: memberAuth,
      instanceId: org.ids.instanceId
    });
    expect(instance.actor?.id).toBe(member.member.actor_id);

    let outsider = await authenticateSession(otherOrg.session);
    await expectServiceError(
      accessService.accessOrganization({
        authInfo: outsider,
        organizationId: org.ids.organizationId
      }),
      'not_found'
    );
    await expectServiceError(
      accessService.accessInstance({ authInfo: outsider, instanceId: org.ids.instanceId }),
      'not_found'
    );
    await expectServiceError(
      accessService.accessOrganization({
        authInfo: memberAuth,
        organizationId: otherOrg.ids.organizationId
      }),
      'not_found'
    );
  });

  it('stops resolving a member once they are removed from the organization', async () => {
    let removed = await bootstrapMember(org);
    let authInfo = await authenticateSession(removed.user.session);
    await accessService.accessOrganization({
      authInfo,
      organizationId: org.ids.organizationId
    });

    let fixture = await loadOrganizationFixture(org.ids);
    let memberRow = await organizationMemberService.getOrganizationMemberById({
      organization: fixture.organization,
      memberId: removed.member.id
    });
    await organizationMemberService.deleteOrganizationMember({
      organization: fixture.organization,
      member: memberRow,
      auditScope: fixture.auditScope
    });

    let stillAuthenticated = await authenticateSession(removed.user.session);
    await expectServiceError(
      accessService.accessOrganization({
        authInfo: stillAuthenticated,
        organizationId: org.ids.organizationId
      }),
      'not_found'
    );
    await expectServiceError(
      accessService.accessInstance({
        authInfo: stillAuthenticated,
        instanceId: org.ids.instanceId
      }),
      'not_found'
    );
  });

  it('binds organization management keys to their own organization', async () => {
    let authInfo = await authenticateKey(org.keys.management);
    let organization = await db.organization.findUniqueOrThrow({
      where: { id: org.ids.organizationId }
    });
    let second = await getSecondProject();

    let access = await accessService.accessOrganization({
      authInfo,
      organizationId: organization.id
    });
    expect(access).toMatchObject({ type: 'actor', member: undefined });
    expect(
      (await accessService.accessOrganization({ authInfo, organizationId: organization.slug }))
        .organization.id
    ).toBe(organization.id);

    for (let instanceId of [org.ids.instanceId, second.instanceId]) {
      let instance = await accessService.accessInstance({ authInfo, instanceId });
      expect(instance.instance.id).toBe(instanceId);
      expect(instance.organization.id).toBe(organization.id);
    }

    await expectServiceError(
      accessService.accessOrganization({
        authInfo,
        organizationId: otherOrg.ids.organizationId
      }),
      'not_found'
    );
    await expectServiceError(
      accessService.accessInstance({ authInfo, instanceId: otherOrg.ids.instanceId }),
      'not_found'
    );
  });

  it('binds instance keys to their own instance', async () => {
    let authInfo = await authenticateKey(org.keys.instanceSecret);
    let second = await getSecondProject();

    let instance = await accessService.accessInstance({
      authInfo,
      instanceId: org.ids.instanceId
    });
    expect(instance.type).toBe('actor');
    expect(instance.project.id).toBe(org.ids.projectId);

    let organization = await accessService.accessOrganization({
      authInfo,
      organizationId: org.ids.organizationId
    });
    expect(organization.organization.id).toBe(org.ids.organizationId);

    await expectServiceError(
      accessService.accessInstance({ authInfo, instanceId: second.instanceId }),
      'not_found'
    );
    await expectServiceError(
      accessService.accessInstance({ authInfo, instanceId: otherOrg.ids.instanceId }),
      'not_found'
    );
    await expectServiceError(
      accessService.accessOrganization({
        authInfo,
        organizationId: otherOrg.ids.organizationId
      }),
      'not_found'
    );
  });

  it('keeps fine grained keys out of organization access', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let { clientSecret } = await sessionClientSecretReferenceService.createForSession({
      instance: fixture.instance,
      sessionId: uniqueId('ses')
    });
    let authInfo = await authenticateKey(clientSecret);

    await expectServiceError(
      accessService.accessOrganization({ authInfo, organizationId: org.ids.organizationId }),
      'forbidden'
    );
    await expectServiceError(
      accessService.accessInstance({ authInfo, instanceId: otherOrg.ids.instanceId }),
      'not_found'
    );

    let instance = await accessService.accessInstance({
      authInfo,
      instanceId: org.ids.instanceId
    });
    expect(instance).toMatchObject({
      type: 'fine_grained',
      actor: undefined,
      member: undefined
    });
  });

  it('grants admin-only scopes to admins but not to regular members', async () => {
    let ownerAuth = await authenticateSession(org.session);
    let memberAuth = await authenticateSession(member.user.session);
    let owner = await accessService.accessOrganization({
      authInfo: ownerAuth,
      organizationId: org.ids.organizationId
    });
    let regular = await accessService.accessOrganization({
      authInfo: memberAuth,
      organizationId: org.ids.organizationId
    });

    let canAccess = (access: typeof owner, authInfo: AuthInfo, possibleScopes: Scope[]) =>
      accessService.canAccessTargetScopes({
        authInfo,
        organization: access.organization,
        member: access.member,
        possibleScopes
      });

    expect(await canAccess(owner, ownerAuth, ['organization.access_policy:write'])).toBe(true);
    expect(await canAccess(regular, memberAuth, ['organization.access_policy:write'])).toBe(
      false
    );
    expect(await canAccess(regular, memberAuth, ['organization.access_policy:read'])).toBe(
      true
    );
    expect(
      await canAccess(regular, memberAuth, [
        'organization.team:write',
        'organization.member:read'
      ])
    ).toBe(true);

    await accessService.checkTargetAccess({
      authInfo: ownerAuth,
      organization: owner.organization,
      member: owner.member,
      possibleScopes: ['organization.team:write']
    });
    await expectServiceError(
      accessService.checkTargetAccess({
        authInfo: memberAuth,
        organization: regular.organization,
        member: regular.member,
        possibleScopes: ['organization.team:write', 'organization.api_key:write']
      }),
      'forbidden'
    );

    expect(
      await accessService.getTargetAccessFilter({
        authInfo: ownerAuth,
        organization: owner.organization,
        member: owner.member,
        possibleScopes: ['organization.access_role:write']
      })
    ).toEqual({ all: true, projectIds: [], instanceIds: [] });
    expect(
      await accessService.getTargetAccessFilter({
        authInfo: memberAuth,
        organization: regular.organization,
        member: regular.member,
        possibleScopes: ['organization.access_role:write']
      })
    ).toEqual({ all: false, projectIds: [], instanceIds: [] });
    expect(
      await accessService.getTargetAccessFilter({
        authInfo: memberAuth,
        organization: regular.organization,
        member: regular.member,
        possibleScopes: ['instance.provider:read']
      })
    ).toEqual({ all: true, projectIds: [], instanceIds: [] });
  });

  it('leaves target checks of machine and fine grained credentials to their token scopes', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let management = await authenticateKey(org.keys.management);
    let { clientSecret } = await sessionClientSecretReferenceService.createForSession({
      instance: fixture.instance,
      sessionId: uniqueId('ses')
    });
    let fineGrained = await authenticateKey(clientSecret);

    for (let authInfo of [management, fineGrained]) {
      expect(
        await accessService.canAccessTargetScopes({
          authInfo,
          organization: fixture.organization,
          possibleScopes: ['organization.access_policy:write']
        })
      ).toBe(true);
      expect(
        await accessService.getTargetAccessFilter({
          authInfo,
          organization: fixture.organization,
          possibleScopes: ['organization.access_policy:write']
        })
      ).toBeNull();
    }

    await expectServiceError(
      accessService.checkAccess({
        authInfo: fineGrained,
        possibleScopes: ['organization.access_policy:write']
      }),
      'forbidden'
    );
    await expectServiceError(
      accessService.checkAccess({
        authInfo: fineGrained,
        possibleScopes: ['organization.access_policy:write'],
        fineGrainedPolicy: 'allow'
      }),
      'forbidden'
    );
  });

  it('rejects resource actors used outside their project', async () => {
    let authInfo = await authenticateSession(org.session);
    let second = await getSecondProject();
    let first = await accessService.accessInstance({
      authInfo,
      instanceId: org.ids.instanceId
    });
    let other = await accessService.accessInstance({
      authInfo,
      instanceId: second.instanceId
    });
    let resourceActor = first.resourceActor!;

    assertResourceActorScope({ project: first.project, resourceActor });
    assertResourceActorScope({ project: undefined, resourceActor: undefined });
    await expectServiceError(
      rejectsSync(() => assertResourceActorScope({ project: other.project, resourceActor })),
      'bad_request'
    );
    await expectServiceError(
      rejectsSync(() => assertResourceActorScope({ project: undefined, resourceActor })),
      'bad_request'
    );

    let privileged = createResourceAuthorization({ restricted: false, resourceActor });
    expect(privileged).toEqual({ type: 'privileged', resourceActor });
    assertResourceAuthorizationScope({ project: first.project, authorization: privileged });
    await expectServiceError(
      rejectsSync(() =>
        assertResourceAuthorizationScope({ project: other.project, authorization: privileged })
      ),
      'bad_request'
    );

    await expectServiceError(
      rejectsSync(() =>
        createResourceAuthorization({
          restricted: true,
          resourceActor,
          accessTags: [],
          project: first.project,
          instance: first.instance
        })
      ),
      'bad_request'
    );
  });
});
