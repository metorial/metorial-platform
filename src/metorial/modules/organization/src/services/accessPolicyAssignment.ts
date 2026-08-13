import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type { AuditScope } from '@metorial/audit-scope';
import {
  AccessPolicy,
  ID,
  Organization,
  OrganizationMember,
  ServiceAccount,
  Team,
  withTransaction
} from '@metorial/db';
import { Fabric } from '@metorial/fabric';
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
    auditScope?: AuditScope;
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

      if (d.auditScope) {
        await Fabric.fire('organization.access_policy.assignment.team.created:before', {
          organization: d.organization,
          team: d.team,
          accessPolicy: d.accessPolicy,
          auditScope: d.auditScope
        });
      }

      let accessPolicyAssignment = await db.accessPolicyAssignment.create({
        data: {
          id: await ID.generateId('accessPolicyAssignment'),
          accessPolicyOid: d.accessPolicy.oid,
          teamOid: d.team.oid
        },
        include: accessPolicyAssignmentInclude
      });

      if (d.auditScope) {
        await Fabric.fire('organization.access_policy.assignment.team.created:after', {
          organization: d.organization,
          team: d.team,
          accessPolicy: d.accessPolicy,
          accessPolicyAssignment,
          auditScope: d.auditScope
        });
      }

      return accessPolicyAssignment;
    });
  }

  async removeAccessPolicyFromTeam(d: {
    organization: Organization;
    team: Team;
    accessPolicy: AccessPolicy;
    auditScope?: AuditScope;
    allowDefault?: boolean;
  }) {
    assertAssignablePolicy(d);

    return await withTransaction(async db => {
      let accessPolicyAssignment = await db.accessPolicyAssignment.findFirst({
        where: {
          accessPolicyOid: d.accessPolicy.oid,
          teamOid: d.team.oid
        },
        include: accessPolicyAssignmentInclude
      });
      if (!accessPolicyAssignment) return null;

      if (d.auditScope) {
        await Fabric.fire('organization.access_policy.assignment.team.deleted:before', {
          organization: d.organization,
          team: d.team,
          accessPolicy: d.accessPolicy,
          accessPolicyAssignment,
          auditScope: d.auditScope
        });
      }

      await db.accessPolicyAssignment.deleteMany({
        where: {
          accessPolicyOid: d.accessPolicy.oid,
          teamOid: d.team.oid
        }
      });

      if (d.auditScope) {
        await Fabric.fire('organization.access_policy.assignment.team.deleted:after', {
          organization: d.organization,
          team: d.team,
          accessPolicy: d.accessPolicy,
          accessPolicyAssignment,
          auditScope: d.auditScope
        });
      }
    });
  }

  async assignAccessPolicyToMember(d: {
    organization: Organization;
    member: OrganizationMember;
    accessPolicy: AccessPolicy;
    auditScope?: AuditScope;
    allowDefault?: boolean;
  }) {
    assertPolicyBelongsToOrganization(d);

    if (d.accessPolicy.type !== 'admin') assertAssignablePolicy(d);

    return await withTransaction(async db => {
      let existingAssignment = await db.accessPolicyAssignment.findFirst({
        where: {
          accessPolicyOid: d.accessPolicy.oid,
          memberOid: d.member.oid
        },
        include: accessPolicyAssignmentInclude
      });
      if (existingAssignment) return existingAssignment;

      if (d.auditScope) {
        await Fabric.fire('organization.access_policy.assignment.member.created:before', {
          organization: d.organization,
          member: d.member,
          accessPolicy: d.accessPolicy,
          auditScope: d.auditScope
        });
      }

      if (d.accessPolicy.type == 'admin') {
        await db.organizationMember.update({
          where: { oid: d.member.oid },
          data: {
            role: 'admin'
          }
        });
      }

      let accessPolicyAssignment = await db.accessPolicyAssignment.create({
        data: {
          id: await ID.generateId('accessPolicyAssignment'),
          accessPolicyOid: d.accessPolicy.oid,
          memberOid: d.member.oid
        },
        include: accessPolicyAssignmentInclude
      });

      if (d.auditScope) {
        await Fabric.fire('organization.access_policy.assignment.member.created:after', {
          organization: d.organization,
          member: d.member,
          accessPolicy: d.accessPolicy,
          accessPolicyAssignment,
          auditScope: d.auditScope
        });
      }

      return accessPolicyAssignment;
    });
  }

  async removeAccessPolicyFromMember(d: {
    organization: Organization;
    member: OrganizationMember;
    accessPolicy: AccessPolicy;
    allowDefault?: boolean;
    auditScope?: AuditScope;
  }) {
    if (d.accessPolicy.type !== 'admin') assertAssignablePolicy(d);

    return await withTransaction(async db => {
      let accessPolicyAssignment = await db.accessPolicyAssignment.findFirst({
        where: {
          accessPolicyOid: d.accessPolicy.oid,
          memberOid: d.member.oid
        },
        include: accessPolicyAssignmentInclude
      });
      if (!accessPolicyAssignment) return null;

      if (d.auditScope) {
        await Fabric.fire('organization.access_policy.assignment.member.deleted:before', {
          organization: d.organization,
          member: d.member,
          accessPolicy: d.accessPolicy,
          accessPolicyAssignment,
          auditScope: d.auditScope
        });
      }

      if (
        d.accessPolicy.type == 'admin' &&
        d.auditScope?.organizationActorOid == d.member.actorOid
      ) {
        throw new ServiceError(
          badRequestError({
            message: 'You cannot remove your own admin access policy'
          })
        );
      }

      await db.accessPolicyAssignment.deleteMany({
        where: {
          accessPolicyOid: d.accessPolicy.oid,
          memberOid: d.member.oid
        }
      });

      if (d.accessPolicy.type == 'admin') {
        await db.organizationMember.update({
          where: { oid: d.member.oid },
          data: {
            role: 'member'
          }
        });
      }

      if (d.auditScope) {
        await Fabric.fire('organization.access_policy.assignment.member.deleted:after', {
          organization: d.organization,
          member: d.member,
          accessPolicy: d.accessPolicy,
          accessPolicyAssignment,
          auditScope: d.auditScope
        });
      }
    });
  }

  async assignAccessPolicyToServiceAccount(d: {
    organization: Organization;
    serviceAccount: ServiceAccount;
    accessPolicy: AccessPolicy;
    auditScope?: AuditScope;
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

      if (d.auditScope) {
        await Fabric.fire(
          'organization.access_policy.assignment.service_account.created:before',
          {
            organization: d.organization,
            serviceAccount: d.serviceAccount,
            accessPolicy: d.accessPolicy,
            auditScope: d.auditScope
          }
        );
      }

      let accessPolicyAssignment = await db.accessPolicyAssignment.create({
        data: {
          id: await ID.generateId('accessPolicyAssignment'),
          accessPolicyOid: d.accessPolicy.oid,
          serviceAccountOid: d.serviceAccount.oid
        },
        include: accessPolicyAssignmentInclude
      });

      if (d.auditScope) {
        await Fabric.fire(
          'organization.access_policy.assignment.service_account.created:after',
          {
            organization: d.organization,
            serviceAccount: d.serviceAccount,
            accessPolicy: d.accessPolicy,
            accessPolicyAssignment,
            auditScope: d.auditScope
          }
        );
      }

      return accessPolicyAssignment;
    });
  }

  async removeAccessPolicyFromServiceAccount(d: {
    organization: Organization;
    serviceAccount: ServiceAccount;
    accessPolicy: AccessPolicy;
    auditScope?: AuditScope;
    allowDefault?: boolean;
  }) {
    assertAssignablePolicy(d);

    return await withTransaction(async db => {
      let accessPolicyAssignment = await db.accessPolicyAssignment.findFirst({
        where: {
          accessPolicyOid: d.accessPolicy.oid,
          serviceAccountOid: d.serviceAccount.oid
        },
        include: accessPolicyAssignmentInclude
      });
      if (!accessPolicyAssignment) return null;

      if (d.auditScope) {
        await Fabric.fire(
          'organization.access_policy.assignment.service_account.deleted:before',
          {
            organization: d.organization,
            serviceAccount: d.serviceAccount,
            accessPolicy: d.accessPolicy,
            accessPolicyAssignment,
            auditScope: d.auditScope
          }
        );
      }

      await db.accessPolicyAssignment.deleteMany({
        where: {
          accessPolicyOid: d.accessPolicy.oid,
          serviceAccountOid: d.serviceAccount.oid
        }
      });

      if (d.auditScope) {
        await Fabric.fire(
          'organization.access_policy.assignment.service_account.deleted:after',
          {
            organization: d.organization,
            serviceAccount: d.serviceAccount,
            accessPolicy: d.accessPolicy,
            accessPolicyAssignment,
            auditScope: d.auditScope
          }
        );
      }
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
          organization: d.organization,
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
