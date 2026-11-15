import {
  bootstrapMember,
  expectOk,
  expectServiceError,
  testContext,
  uniqueId,
  useOrganization
} from '@metorial/e2e';
import { db, loadOrganizationFixture } from '@metorial/e2e/db';
import {
  accessPolicyAssignmentService,
  accessPolicyService,
  accessRoleService,
  teamService
} from '@metorial/module-organization';
import { describe, expect, it } from 'vitest';
import { accessService, authenticationService, type Scope } from '../src';

type PolicyDocument = PrismaJson.PolicyDocument;

describe('module-access access policies', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  let secondProject: Promise<{ projectId: string; instanceId: string }> | undefined;

  let getSecondProject = () =>
    (secondProject ??= (async () => {
      let base = `/dashboard/organizations/${org.ids.organizationId}`;
      let project = expectOk(
        await org.clients.rest.post(`${base}/projects`, { name: uniqueId('E2E Project') })
      );
      let instances = expectOk(
        await org.clients.rest.get(`${base}/instances`, { query: { project_id: project.id } })
      );

      return { projectId: project.id as string, instanceId: instances.items[0].id as string };
    })());

  let newMember = async () => {
    let bootstrapped = await bootstrapMember(org);
    let authInfo = await authenticationService.authenticate({
      type: 'user_session',
      sessionClientSecret: bootstrapped.user.session,
      context: testContext()
    });
    let access = await accessService.accessOrganization({
      authInfo,
      organizationId: org.ids.organizationId
    });
    let member = access.member!;

    let canAccess = (
      possibleScopes: Scope[],
      target: { projectId?: string; instanceId?: string } = {}
    ) =>
      accessService.canAccessTargetScopes({
        authInfo,
        organization: access.organization,
        member,
        project: target.projectId ? { id: target.projectId } : undefined,
        instance: target.instanceId ? { id: target.instanceId } : undefined,
        possibleScopes
      });

    let reachesInstance = async (instanceId: string) => {
      try {
        await accessService.accessInstance({ authInfo, instanceId });
        return true;
      } catch (error: any) {
        if (error?.data?.code == 'not_found') return false;
        throw error;
      }
    };

    let targetFilter = (possibleScopes: Scope[]) =>
      accessService.getTargetAccessFilter({
        authInfo,
        organization: access.organization,
        member,
        possibleScopes
      });

    return {
      userId: bootstrapped.user.id,
      authInfo,
      organization: access.organization,
      member,
      canAccess,
      reachesInstance,
      targetFilter
    };
  };

  let ownerFixture = () => loadOrganizationFixture(org.ids);

  let createPolicy = async (document: PolicyDocument) => {
    let fixture = await ownerFixture();
    return await accessPolicyService.createAccessPolicy({
      organization: fixture.organization,
      auditScope: fixture.auditScope,
      input: { name: uniqueId('Policy'), document }
    });
  };

  let removeDefaultPolicies = async (
    member: Awaited<ReturnType<typeof newMember>>['member']
  ) => {
    let fixture = await ownerFixture();
    let everyone = await accessPolicyService.getDefaultAccessPolicy({
      organization: fixture.organization,
      type: 'everyone'
    });

    await accessPolicyAssignmentService.removeAccessPolicyFromMember({
      organization: fixture.organization,
      member,
      accessPolicy: everyone!,
      allowDefault: true
    });
  };

  it('takes instance access away from members without any policy', async () => {
    let member = await newMember();
    expect(await member.reachesInstance(org.ids.instanceId)).toBe(true);
    expect(await member.canAccess(['organization.member:read'])).toBe(true);

    await removeDefaultPolicies(member.member);

    expect(await member.reachesInstance(org.ids.instanceId)).toBe(false);
    expect(await member.canAccess(['organization.member:read'])).toBe(false);
    expect(await member.targetFilter(['instance.provider:read'])).toEqual({
      all: false,
      projectIds: [],
      instanceIds: []
    });
    expect(
      await accessService.hasAnyTargetAccess({
        authInfo: member.authInfo,
        organization: member.organization,
        member: member.member
      })
    ).toBe(false);
    expect(
      (
        await accessService.accessOrganization({
          authInfo: member.authInfo,
          organizationId: org.ids.organizationId
        })
      ).member?.id
    ).toBe(member.member.id);

    await accessPolicyAssignmentService.syncMemberDefaultPolicies({
      organization: member.organization,
      member: member.member
    });
    expect(await member.reachesInstance(org.ids.instanceId)).toBe(true);
  });

  it('limits project and instance policies to their targets', async () => {
    let member = await newMember();
    let second = await getSecondProject();
    await removeDefaultPolicies(member.member);

    let policy = await createPolicy({
      access: [{ target: org.ids.projectId, scopes: ['instance.provider:read'] }]
    });
    let fixture = await ownerFixture();
    await accessPolicyAssignmentService.assignAccessPolicyToMember({
      organization: fixture.organization,
      member: member.member,
      accessPolicy: policy,
      auditScope: fixture.auditScope
    });

    let first = { projectId: org.ids.projectId, instanceId: org.ids.instanceId };
    expect(await member.reachesInstance(first.instanceId)).toBe(true);
    expect(await member.reachesInstance(second.instanceId)).toBe(false);
    expect(await member.canAccess(['instance.provider:read'], first)).toBe(true);
    expect(await member.canAccess(['instance.provider:write'], first)).toBe(false);
    expect(await member.canAccess(['instance.provider:read'], second)).toBe(false);
    expect(await member.canAccess(['instance.provider:read'])).toBe(false);
    expect(await member.targetFilter(['instance.provider:read'])).toEqual({
      all: false,
      projectIds: [org.ids.projectId],
      instanceIds: []
    });

    await accessPolicyService.updateAccessPolicy({
      accessPolicy: policy,
      organization: fixture.organization,
      auditScope: fixture.auditScope,
      input: {
        document: {
          access: [{ target: second.instanceId, scopes: ['instance.provider:read'] }]
        }
      }
    });

    expect(await member.reachesInstance(first.instanceId)).toBe(false);
    expect(await member.reachesInstance(second.instanceId)).toBe(true);
    expect(await member.targetFilter(['instance.provider:read'])).toEqual({
      all: false,
      projectIds: [],
      instanceIds: [second.instanceId]
    });
    await accessService.checkTargetAccess({
      authInfo: member.authInfo,
      organization: member.organization,
      member: member.member,
      project: { id: second.projectId },
      instance: { id: second.instanceId },
      possibleScopes: ['instance.provider:read']
    });
    await expectServiceError(
      accessService.checkTargetAccess({
        authInfo: member.authInfo,
        organization: member.organization,
        member: member.member,
        project: { id: second.projectId },
        instance: { id: second.instanceId },
        possibleScopes: ['instance.provider:write']
      }),
      'forbidden'
    );
  });

  it('applies team policies to current team members only', async () => {
    let member = await newMember();
    let fixture = await ownerFixture();
    let actor = await db.organizationActor.findUniqueOrThrow({
      where: { oid: member.member.actorOid }
    });
    let teamInput = {
      organization: fixture.organization,
      auditScope: fixture.auditScope
    };

    let policy = await createPolicy({
      access: [
        {
          target: org.ids.organizationId,
          scopes: ['organization.team:read', 'organization.team:write']
        }
      ]
    });
    let team = await teamService.createTeam({
      ...teamInput,
      input: { name: uniqueId('Team') }
    });
    expect(await member.canAccess(['organization.team:write'])).toBe(false);

    await accessPolicyAssignmentService.assignAccessPolicyToTeam({
      ...teamInput,
      team,
      accessPolicy: policy
    });
    expect(await member.canAccess(['organization.team:write'])).toBe(false);

    await teamService.assignActorToTeam({ ...teamInput, team, actor });
    expect(await member.canAccess(['organization.team:write'])).toBe(true);

    await teamService.removeActorFromTeam({ ...teamInput, team, actor });
    expect(await member.canAccess(['organization.team:write'])).toBe(false);

    await teamService.assignActorToTeam({ ...teamInput, team, actor });
    expect(await member.canAccess(['organization.team:write'])).toBe(true);

    await accessPolicyAssignmentService.removeAccessPolicyFromTeam({
      ...teamInput,
      team,
      accessPolicy: policy
    });
    expect(await member.canAccess(['organization.team:write'])).toBe(false);
    expect(await db.accessPolicyAssignment.count({ where: { teamOid: team.oid } })).toBe(0);
  });

  it('follows role changes and policy deletion', async () => {
    let member = await newMember();
    let fixture = await ownerFixture();
    let scope = { organization: fixture.organization, auditScope: fixture.auditScope };

    let role = await accessRoleService.createAccessRole({
      ...scope,
      input: {
        name: uniqueId('Role'),
        scopes: ['organization.access_role:read', 'organization.access_role:write']
      }
    });
    let policy = await createPolicy({
      access: [{ target: org.ids.organizationId, roles: [role.slug] }]
    });
    await accessPolicyAssignmentService.assignAccessPolicyToMember({
      ...scope,
      member: member.member,
      accessPolicy: policy
    });
    expect(await member.canAccess(['organization.access_role:write'])).toBe(true);

    let narrowed = await accessRoleService.updateAccessRole({
      ...scope,
      accessRole: role,
      input: { scopes: ['organization.access_role:read'] }
    });
    expect(await member.canAccess(['organization.access_role:write'])).toBe(false);

    await accessRoleService.updateAccessRole({
      ...scope,
      accessRole: narrowed,
      input: { scopes: ['organization.access_role:read', 'organization.access_role:write'] }
    });
    expect(await member.canAccess(['organization.access_role:write'])).toBe(true);

    await expectServiceError(
      accessRoleService.deleteAccessRole({
        ...scope,
        accessRole: await accessRoleService.getAccessRoleById({
          organization: fixture.organization,
          accessRoleId: role.id
        })
      }),
      'bad_request'
    );

    await accessPolicyService.deleteAccessPolicy({
      ...scope,
      accessPolicy: await accessPolicyService.getAccessPolicyById({
        organization: fixture.organization,
        accessPolicyId: policy.id
      })
    });
    expect(await member.canAccess(['organization.access_role:write'])).toBe(false);
    expect(
      await db.accessPolicyAssignment.count({ where: { accessPolicyOid: policy.oid } })
    ).toBe(0);
  });

  it('promotes and demotes members through the default admin policy', async () => {
    let member = await newMember();
    let fixture = await ownerFixture();
    let memberFixture = await loadOrganizationFixture({
      organizationId: org.ids.organizationId,
      userId: member.userId
    });
    let admin = await accessPolicyService.getDefaultAccessPolicy({
      organization: fixture.organization,
      type: 'admin'
    });
    let everyone = await accessPolicyService.getDefaultAccessPolicy({
      organization: fixture.organization,
      type: 'everyone'
    });

    expect(await member.canAccess(['organization.access_policy:write'])).toBe(false);

    await accessPolicyAssignmentService.assignAccessPolicyToMember({
      organization: fixture.organization,
      member: member.member,
      accessPolicy: admin!,
      auditScope: fixture.auditScope
    });
    expect(
      (await db.organizationMember.findUniqueOrThrow({ where: { oid: member.member.oid } }))
        .role
    ).toBe('admin');
    expect(await member.canAccess(['organization.access_policy:write'])).toBe(true);

    await expectServiceError(
      accessPolicyAssignmentService.removeAccessPolicyFromMember({
        organization: fixture.organization,
        member: member.member,
        accessPolicy: admin!,
        auditScope: memberFixture.auditScope
      }),
      'bad_request'
    );
    expect(await member.canAccess(['organization.access_policy:write'])).toBe(true);

    await accessPolicyAssignmentService.removeAccessPolicyFromMember({
      organization: fixture.organization,
      member: member.member,
      accessPolicy: admin!,
      auditScope: fixture.auditScope
    });
    expect(
      (await db.organizationMember.findUniqueOrThrow({ where: { oid: member.member.oid } }))
        .role
    ).toBe('member');
    expect(await member.canAccess(['organization.access_policy:write'])).toBe(false);

    let team = await teamService.createTeam({
      organization: fixture.organization,
      auditScope: fixture.auditScope,
      input: { name: uniqueId('Team') }
    });
    for (let accessPolicy of [admin!, everyone!]) {
      await expectServiceError(
        accessPolicyAssignmentService.assignAccessPolicyToTeam({
          organization: fixture.organization,
          team,
          accessPolicy,
          auditScope: fixture.auditScope
        }),
        'bad_request'
      );
    }
    await expectServiceError(
      accessPolicyAssignmentService.assignAccessPolicyToMember({
        organization: fixture.organization,
        member: member.member,
        accessPolicy: everyone!,
        auditScope: fixture.auditScope
      }),
      'bad_request'
    );
  });

  it('keeps policies inside their organization', async () => {
    let fixture = await ownerFixture();
    let other = await loadOrganizationFixture(otherOrg.ids);
    let otherRole = await accessRoleService.createAccessRole({
      organization: other.organization,
      auditScope: other.auditScope,
      input: { name: uniqueId('Role'), scopes: ['organization.team:read'] }
    });

    let create = (document: PolicyDocument) =>
      accessPolicyService.createAccessPolicy({
        organization: fixture.organization,
        auditScope: fixture.auditScope,
        input: { name: uniqueId('Policy'), document }
      });
    let scopes: string[] = ['organization.team:read'];

    await expectServiceError(
      create({ access: [{ target: otherOrg.ids.organizationId, scopes }] }),
      'bad_request'
    );
    await expectServiceError(
      create({ access: [{ target: otherOrg.ids.projectId, scopes }] }),
      'not_found'
    );
    await expectServiceError(
      create({ access: [{ target: otherOrg.ids.instanceId, scopes }] }),
      'not_found'
    );
    await expectServiceError(
      create({ access: [{ target: org.ids.organizationId, roles: [otherRole.id] }] }),
      'not_found'
    );
    await expectServiceError(
      create({ access: [{ target: `usr_${uniqueId('x')}`, scopes }] }),
      'bad_request'
    );

    let policy = await createPolicy({ access: [{ target: org.ids.organizationId, scopes }] });
    await expectServiceError(
      accessPolicyAssignmentService.assignAccessPolicyToMember({
        organization: other.organization,
        member: other.member,
        accessPolicy: policy,
        auditScope: other.auditScope
      }),
      'bad_request'
    );
    expect(
      await db.accessPolicyAssignment.count({ where: { accessPolicyOid: policy.oid } })
    ).toBe(0);
  });
});
