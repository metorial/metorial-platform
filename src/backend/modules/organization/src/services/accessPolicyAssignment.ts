import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import {
  AccessPolicy,
  ID,
  Organization,
  OrganizationActor,
  OrganizationMember,
  ServiceAccount,
  Team,
  withTransaction
} from '@metorial/db';
import { accessPolicyService } from './accessPolicy';

export let accessPolicyAssignmentInclude = {
  accessPolicy: {
    include: {
      organization: true
    }
  },
  member: true,
  team: true,
  serviceAccount: true
} as const;

let assertPolicyBelongsToOrganization = (d: {
  organization: Organization;
  accessPolicy: AccessPolicy;
}) => {
  if (d.accessPolicy.organizationOid != d.organization.oid) {
    throw new ServiceError(
      badRequestError({
        message: 'Access policy does not belong to the provided organization'
      })
    );
  }
};

let assertAssignablePolicy = (d: { accessPolicy: AccessPolicy; allowDefault?: boolean }) => {
  if (!d.allowDefault && d.accessPolicy.type != 'custom') {
    throw new ServiceError(
      badRequestError({
        message: 'Default access policies cannot be assigned manually'
      })
    );
  }
};

class AccessPolicyAssignmentService {
  async assignAccessPolicyToTeam(d: {
    organization: Organization;
    team: Team;
    accessPolicy: AccessPolicy;
    allowDefault?: boolean;
  }) {
    assertPolicyBelongsToOrganization(d);
    assertAssignablePolicy(d);

    return await withTransaction(async db => {
      let existingAssignment = await db.accessPolicyAssignment.findFirst({
        where: {
          accessPolicyOid: d.accessPolicy.oid,
          teamOid: d.team.oid
        },
        include: accessPolicyAssignmentInclude
      });
      if (existingAssignment) return existingAssignment;

      return db.accessPolicyAssignment.create({
        data: {
          id: await ID.generateId('accessPolicyAssignment'),
          accessPolicyOid: d.accessPolicy.oid,
          teamOid: d.team.oid
        },
        include: accessPolicyAssignmentInclude
      });
    });
  }

  async removeAccessPolicyFromTeam(d: {
    team: Team;
    accessPolicy: AccessPolicy;
    allowDefault?: boolean;
  }) {
    assertAssignablePolicy(d);

    return await withTransaction(async db => {
      await db.accessPolicyAssignment.deleteMany({
        where: {
          accessPolicyOid: d.accessPolicy.oid,
          teamOid: d.team.oid
        }
      });
    });
  }

  async assignAccessPolicyToMember(d: {
    organization: Organization;
    member: OrganizationMember;
    accessPolicy: AccessPolicy;
    allowDefault?: boolean;
  }) {
    assertPolicyBelongsToOrganization(d);
    assertAssignablePolicy(d);

    return await withTransaction(async db => {
      if (d.accessPolicy.type == 'admin') {
        await db.organizationMember.update({
          where: { oid: d.member.oid },
          data: {
            role: 'admin'
          }
        });
      }

      let existingAssignment = await db.accessPolicyAssignment.findFirst({
        where: {
          accessPolicyOid: d.accessPolicy.oid,
          memberOid: d.member.oid
        },
        include: accessPolicyAssignmentInclude
      });
      if (existingAssignment) return existingAssignment;

      return db.accessPolicyAssignment.create({
        data: {
          id: await ID.generateId('accessPolicyAssignment'),
          accessPolicyOid: d.accessPolicy.oid,
          memberOid: d.member.oid
        },
        include: accessPolicyAssignmentInclude
      });
    });
  }

  async removeAccessPolicyFromMember(d: {
    member: OrganizationMember;
    accessPolicy: AccessPolicy;
    allowDefault?: boolean;
    performedBy?: OrganizationActor;
  }) {
    assertAssignablePolicy(d);

    return await withTransaction(async db => {
      await db.accessPolicyAssignment.deleteMany({
        where: {
          accessPolicyOid: d.accessPolicy.oid,
          memberOid: d.member.oid
        }
      });

      if (d.accessPolicy.type == 'admin') {
        if (d.performedBy?.oid == d.member.actorOid) {
          throw new ServiceError(
            badRequestError({
              message: 'You cannot remove your own admin access policy'
            })
          );
        }

        await db.organizationMember.update({
          where: { oid: d.member.oid },
          data: {
            role: 'member'
          }
        });
      }
    });
  }

  async assignAccessPolicyToServiceAccount(d: {
    organization: Organization;
    serviceAccount: ServiceAccount;
    accessPolicy: AccessPolicy;
    allowDefault?: boolean;
  }) {
    assertPolicyBelongsToOrganization(d);
    assertAssignablePolicy(d);

    return await withTransaction(async db => {
      let existingAssignment = await db.accessPolicyAssignment.findFirst({
        where: {
          accessPolicyOid: d.accessPolicy.oid,
          serviceAccountOid: d.serviceAccount.oid
        },
        include: accessPolicyAssignmentInclude
      });
      if (existingAssignment) return existingAssignment;

      return await db.accessPolicyAssignment.create({
        data: {
          id: await ID.generateId('accessPolicyAssignment'),
          accessPolicyOid: d.accessPolicy.oid,
          serviceAccountOid: d.serviceAccount.oid
        },
        include: accessPolicyAssignmentInclude
      });
    });
  }

  async removeAccessPolicyFromServiceAccount(d: {
    serviceAccount: ServiceAccount;
    accessPolicy: AccessPolicy;
    allowDefault?: boolean;
  }) {
    assertAssignablePolicy(d);

    return await withTransaction(async db => {
      await db.accessPolicyAssignment.deleteMany({
        where: {
          accessPolicyOid: d.accessPolicy.oid,
          serviceAccountOid: d.serviceAccount.oid
        }
      });
    });
  }

  async syncMemberDefaultPolicies(d: {
    organization: Organization;
    member: OrganizationMember;
  }) {
    return withTransaction(async db => {
      if (d.organization.authVersion != 'v2') {
        return;
      }

      let everyonePolicy = await accessPolicyService.getDefaultAccessPolicy({
        organization: d.organization,
        type: 'everyone'
      });
      let adminPolicy = await accessPolicyService.getDefaultAccessPolicy({
        organization: d.organization,
        type: 'admin'
      });

      if (!everyonePolicy || !adminPolicy) {
        throw new ServiceError(
          badRequestError({
            message: 'Default access policies are missing for this organization'
          })
        );
      }

      await this.assignAccessPolicyToMember({
        organization: d.organization,
        member: d.member,
        accessPolicy: everyonePolicy,
        allowDefault: true
      });

      if (d.member.role == 'admin') {
        await this.assignAccessPolicyToMember({
          organization: d.organization,
          member: d.member,
          accessPolicy: adminPolicy,
          allowDefault: true
        });
      } else {
        await this.removeAccessPolicyFromMember({
          member: d.member,
          accessPolicy: adminPolicy,
          allowDefault: true
        });
      }
    });
  }
}

export let accessPolicyAssignmentService = Service.create(
  'accessPolicyAssignmentService',
  () => new AccessPolicyAssignmentService()
).build();
