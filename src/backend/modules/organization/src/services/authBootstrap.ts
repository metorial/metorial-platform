import { canonicalize } from '@mtsrc/canonicalize';
import { Service } from '@mtsrc/service';
import { Context } from '@metorial/context';
import {
  Organization,
  OrganizationActor,
  OrganizationMember,
  withTransaction
} from '@metorial/db';
import {
  adminScopes,
  defaultAdminScopesHash,
  defaultEveryoneScopesHash,
  everyoneScopes
} from '../definitions/defaultScopes';
import { accessPolicyService } from './accessPolicy';
import { accessPolicyAssignmentService } from './accessPolicyAssignment';
import { organizationActorService } from './organizationActor';

let equalDocuments = (left: PrismaJson.PolicyDocument, right: PrismaJson.PolicyDocument) =>
  canonicalize(left) == canonicalize(right);

class AuthBootstrapService {
  async getEveryoneScopes() {
    return everyoneScopes;
  }

  async getAdminScopes() {
    return adminScopes;
  }

  async getEveryonePolicyDocument(d: {
    organization: Organization;
  }): Promise<PrismaJson.PolicyDocument> {
    return {
      access: [
        {
          target: d.organization.id,
          scopes: await this.getEveryoneScopes()
        }
      ]
    };
  }

  async getAdminPolicyDocument(d: {
    organization: Organization;
  }): Promise<PrismaJson.PolicyDocument> {
    return {
      access: [
        {
          target: d.organization.id,
          scopes: await this.getAdminScopes()
        }
      ]
    };
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
      let performedBy =
        d.performedBy ?? (await organizationActorService.getSystemActor({ organization }));

      let everyoneDocument = await this.getEveryonePolicyDocument({ organization });
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

      await db.accessPolicy.updateMany({
        where: { id: everyonePolicy.id },
        data: { autoUpdateScopesHash: defaultEveryoneScopesHash }
      });

      let adminDocument = await this.getAdminPolicyDocument({ organization });
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

      await db.accessPolicy.updateMany({
        where: { id: adminPolicy.id },
        data: { autoUpdateScopesHash: defaultAdminScopesHash }
      });

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
