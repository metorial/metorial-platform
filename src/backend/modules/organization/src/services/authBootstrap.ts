import { Service } from '@lowerdeck/service';
import { Context } from '@metorial/context';
import {
  db,
  ID,
  Organization,
  OrganizationActor,
  OrganizationMember,
  withTransaction
} from '@metorial/db';
import { coreScopes, Scope } from '@metorial/module-access';
import { accessPolicyService } from './accessPolicy';
import { accessPolicyAssignmentService } from './accessPolicyAssignment';
import { accessRoleService } from './accessRole';

let adminOnlyScopes: Scope[] = [
  'organization:write',
  'organization.invite:read',
  'organization.invite:write',
  'organization.member:read',
  'organization.member:write',
  'organization.team:read',
  'organization.team:write',
  'organization.api_key:read',
  'organization.api_key:write',
  'organization.api_key:reveal',
  'organization.access_role:read',
  'organization.access_role:write',
  'organization.access_policy:read',
  'organization.access_policy:write',
  'organization.oauth_app:read',
  'organization.oauth_app:write',
  'organization.oauth_installation:read',
  'organization.oauth_installation:write',
  'organization.oauth_authorization:read',
  'organization.oauth_authorization:write',
  'organization.oauth_authorization:authorize'
];

let everyoneScopes: Scope[] = coreScopes.filter(
  scope =>
    !scope.startsWith('user:') &&
    !adminOnlyScopes.includes(scope) &&
    !scope.startsWith('consumer#')
) as Scope[];

let adminScopes = [...new Set([...everyoneScopes, ...adminOnlyScopes])];

let defaultSystemActorImage = {
  type: 'url' as const,
  url: 'https://cdn.metorial.com/2025-06-13--14-59-55/logos/metorial/primary_logo/raw.svg'
};

let equalScopes = (left: string[], right: string[]) => {
  let a = [...new Set(left)].sort();
  let b = [...new Set(right)].sort();

  return a.length == b.length && a.every((scope, index) => scope == b[index]);
};

let equalDocuments = (left: PrismaJson.PolicyDocument, right: PrismaJson.PolicyDocument) =>
  JSON.stringify(left) == JSON.stringify(right);

class AuthBootstrapService {
  getEveryoneScopes() {
    return everyoneScopes;
  }

  getAdminRoleScopes() {
    return adminScopes;
  }

  getEveryonePolicyDocument(d: { organization: Organization }): PrismaJson.PolicyDocument {
    return {
      access: [
        {
          target: d.organization.id,
          scopes: this.getEveryoneScopes()
        }
      ]
    };
  }

  getAdminPolicyDocument(d: {
    organization: Organization;
    adminAccessRole: { id: string };
  }): PrismaJson.PolicyDocument {
    return {
      access: [
        {
          target: d.organization.id,
          roles: [d.adminAccessRole.id]
        }
      ]
    };
  }

  private async ensureSystemActor(d: { organization: Organization }) {
    let existingActor = await db.organizationActor.findFirst({
      where: {
        organizationOid: d.organization.oid,
        isSystem: true
      },
      include: {
        organization: true
      }
    });
    if (existingActor) return existingActor;

    let actor = await db.organizationActor.create({
      data: {
        id: await ID.generateId('organizationActor'),
        type: 'system',
        name: 'Metorial',
        image: defaultSystemActorImage,
        isSystem: true,
        organizationOid: d.organization.oid
      },
      include: {
        organization: true,
        member: true,
        machineAccess: true,
        teams: { include: { team: true } }
      }
    });

    return actor;
  }

  async ensureOrganizationAuthVersionV2(d: {
    organization: Organization;
    context: Context;
    performedBy?: OrganizationActor;
  }) {
    return withTransaction(async db => {
      let organization = await db.organization.findUniqueOrThrow({
        where: { oid: d.organization.oid }
      });
      let performedBy = d.performedBy ?? (await this.ensureSystemActor({ organization }));

      let adminAccessRole = await db.accessRole.findFirst({
        where: {
          organizationOid: organization.oid,
          isAdmin: true
        },
        include: {
          organization: true,
          accessRoleVersions: {
            orderBy: {
              index: 'desc'
            }
          }
        }
      });
      if (!adminAccessRole) {
        adminAccessRole = await accessRoleService.createAccessRole({
          organization,
          performedBy,
          context: d.context,
          input: {
            name: 'Administrators',
            description:
              'Administrative access for managing members, roles, policies, oauth apps, and API keys.',
            scopes: this.getAdminRoleScopes(),
            isAdmin: true,
            message: 'Bootstrap default administrator role'
          }
        });
      } else if (!equalScopes(adminAccessRole.scopes, this.getAdminRoleScopes())) {
        adminAccessRole = await accessRoleService.updateAccessRole({
          accessRole: adminAccessRole,
          organization,
          performedBy,
          context: d.context,
          input: {
            scopes: this.getAdminRoleScopes(),
            message: 'Reconcile default administrator role scopes'
          }
        });
      }

      let everyoneDocument = this.getEveryonePolicyDocument({ organization });
      let everyonePolicy = await accessPolicyService.getDefaultAccessPolicy({
        organization,
        type: 'everyone'
      });
      if (!everyonePolicy) {
        everyonePolicy = await accessPolicyService.createAccessPolicy({
          organization,
          performedBy,
          context: d.context,
          input: {
            type: 'everyone',
            name: 'Everyone',
            description:
              'Default access for every member across projects and instances in this organization.',
            document: everyoneDocument,
            message: 'Bootstrap default everyone policy'
          }
        });
      } else if (!equalDocuments(everyonePolicy.document, everyoneDocument)) {
        everyonePolicy = await accessPolicyService.updateAccessPolicy({
          accessPolicy: everyonePolicy,
          organization,
          performedBy,
          context: d.context,
          allowDefaultDocumentUpdate: true,
          input: {
            document: everyoneDocument,
            message: 'Reconcile default everyone policy'
          }
        });
      }

      let adminDocument = this.getAdminPolicyDocument({
        organization,
        adminAccessRole
      });
      let adminPolicy = await accessPolicyService.getDefaultAccessPolicy({
        organization,
        type: 'admin'
      });
      if (!adminPolicy) {
        adminPolicy = await accessPolicyService.createAccessPolicy({
          organization,
          performedBy,
          context: d.context,
          input: {
            type: 'admin',
            name: 'Administrators',
            description:
              'Default administrative policy for managing members, roles, policies, oauth apps, and API keys.',
            document: adminDocument,
            message: 'Bootstrap default administrators policy'
          }
        });
      } else if (!equalDocuments(adminPolicy.document, adminDocument)) {
        adminPolicy = await accessPolicyService.updateAccessPolicy({
          accessPolicy: adminPolicy,
          organization,
          performedBy,
          context: d.context,
          allowDefaultDocumentUpdate: true,
          input: {
            document: adminDocument,
            message: 'Reconcile default administrators policy'
          }
        });
      }

      let members = await db.organizationMember.findMany({
        where: {
          organizationOid: organization.oid,
          status: 'active'
        }
      });

      for (let member of members) {
        await accessPolicyAssignmentService.syncMemberDefaultPolicies({
          organization: {
            ...organization,
            authVersion: 'v2'
          },
          member: member as OrganizationMember
        });
      }

      await db.organizationMember.updateMany({
        where: {
          organizationOid: organization.oid,
          status: 'active'
        },
        data: {
          isV2Member: true
        }
      });

      await db.organization.update({
        where: { oid: organization.oid },
        data: {
          authVersion: 'v2'
        }
      });

      return {
        organization: {
          ...organization,
          authVersion: 'v2' as const
        },
        performedBy,
        adminAccessRole,
        everyonePolicy,
        adminPolicy
      };
    });
  }
}

export let authBootstrapService = Service.create(
  'authBootstrapService',
  () => new AuthBootstrapService()
).build();
