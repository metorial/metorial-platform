import { forbiddenError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { AuditScope } from '@metorial/audit-scope';
import {
  addAfterTransactionHook,
  addAwaitedAfterTransactionHook,
  db,
  ID,
  Organization,
  OrganizationMember,
  OrganizationMemberRole,
  User,
  withTransaction
} from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { syncOrgMemberToConsumer } from '@metorial/module-consumer-core';
import { metorialResourceService } from '@metorial-subspace/module-tenant';
import { accessPolicyAssignmentService } from './accessPolicyAssignment';
import { organizationActorService } from './organizationActor';

let include = {
  actor: {
    include: {
      organization: true,
      teams: { include: { team: true } }
    }
  },
  organization: true,
  user: true,
  policies: {
    include: {
      accessPolicy: true
    }
  }
};

let isPrismaUniqueConstraintError = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code: string }).code === 'P2002';

class OrganizationMemberService {
  private async ensureOrganizationMemberActive(organizationMember: OrganizationMember) {
    if (organizationMember.status !== 'active') {
      throw new ServiceError(
        forbiddenError({
          message: 'Cannot perform this action on a deleted organization member'
        })
      );
    }
  }

  private async assertOrganizationStillHasAnotherAdmin(d: {
    organization: Organization;
    member: OrganizationMember;
  }) {
    if (d.member.role !== 'admin') return;

    return withTransaction(async db => {
      let otherAdminCount = await db.organizationMember.count({
        where: {
          organizationOid: d.organization.oid,
          status: 'active',
          role: 'admin',
          oid: { not: d.member.oid },
          user: {
            type: { not: 'system' }
          }
        }
      });
      if (otherAdminCount > 0) return;

      throw new ServiceError(
        forbiddenError({
          message: 'Admins cannot be removed unless there is another admin',
          reason: 'last_admin'
        })
      );
    });
  }

  async createOrganizationMember(d: {
    user: User;
    organization: Organization;
    input: {
      role: OrganizationMemberRole;
    };
    auditScope: AuditScope;
  }) {
    for (let attempt = 0; ; attempt++) {
      try {
        return await withTransaction(async db => {
          let existingMember = await db.organizationMember.findFirst({
            where: {
              organizationOid: d.organization.oid,
              userOid: d.user.oid
            },
            include
          });
          if (existingMember && existingMember.status == 'active') {
            return existingMember;
          }

          let actor =
            existingMember?.actor ??
            (await organizationActorService.createOrganizationActor({
              input: {
                type: d.user.type === 'system' ? 'system' : 'member',
                email: d.user.type === 'system' ? undefined : d.user.email,
                name: d.user.name,
                image: d.user.image
              },
              auditScope: d.auditScope,
              organization: d.organization
            }));

          await Fabric.fire('organization.member.created:before', {
            actor,
            user: d.user,
            organization: d.organization,
            auditScope: d.auditScope
          });

          let member = existingMember
            ? await db.organizationMember.update({
                where: { oid: existingMember.oid },
                data: {
                  status: 'active',
                  deletedAt: null,
                  isV2Member: d.organization.authVersion == 'v2',
                  role: d.input.role,
                  organizationOid: d.organization.oid,
                  actorOid: actor.oid,
                  userOid: d.user.oid
                },
                include
              })
            : await db.organizationMember.create({
                data: {
                  id: await ID.generateId('organizationMember'),
                  status: 'active',
                  isV2Member: d.organization.authVersion == 'v2',
                  role: d.input.role,
                  organizationOid: d.organization.oid,
                  actorOid: actor.oid,
                  userOid: d.user.oid
                },
                include
              });

          await Fabric.fire('organization.member.created:after', {
            organization: d.organization,
            user: d.user,
            actor,
            member,
            auditScope: d.auditScope
          });

          await accessPolicyAssignmentService.syncMemberDefaultPolicies({
            organization: d.organization,
            member
          });

          await addAfterTransactionHook(() => syncOrgMemberToConsumer(member));
          await addAwaitedAfterTransactionHook(() =>
            metorialResourceService.syncOrganizationMember(member)
          );

          return member;
        });
      } catch (error) {
        if (attempt > 0 || !isPrismaUniqueConstraintError(error)) throw error;
      }
    }
  }

  async updateOrganizationMember(d: {
    organization: Organization;
    member: OrganizationMember;
    input: {
      role?: OrganizationMemberRole;
    };
    auditScope: AuditScope;
  }) {
    await this.ensureOrganizationMemberActive(d.member);

    if (
      d.member.role == 'admin' &&
      d.input.role == 'member' &&
      d.member.actorOid == d.auditScope.organizationActorOid
    ) {
      throw new ServiceError(
        forbiddenError({
          message: 'Admins cannot remove admin rights from themselves'
        })
      );
    }

    return withTransaction(async db => {
      if (d.member.role == 'admin' && d.input.role == 'member') {
        await this.assertOrganizationStillHasAnotherAdmin({
          organization: d.organization,
          member: d.member
        });
      }

      await Fabric.fire('organization.member.updated:before', d);

      let member = await db.organizationMember.update({
        where: { oid: d.member.oid },
        data: {
          isV2Member: d.organization.authVersion == 'v2' ? true : undefined,
          role: d.input.role
        },
        include
      });

      await Fabric.fire('organization.member.updated:after', {
        organization: d.organization,
        input: d.input,
        member,
        previousMember: d.member,
        auditScope: d.auditScope
      });

      await accessPolicyAssignmentService.syncMemberDefaultPolicies({
        organization: d.organization,
        member
      });

      await addAfterTransactionHook(() => syncOrgMemberToConsumer(member));
      await addAwaitedAfterTransactionHook(() =>
        metorialResourceService.syncOrganizationMember(member)
      );

      return member;
    });
  }

  async deleteOrganizationMember(d: {
    organization: Organization;
    member: OrganizationMember;
    auditScope: AuditScope;
    allowLastAdminRemoval?: boolean;
  }) {
    await this.ensureOrganizationMemberActive(d.member);

    return withTransaction(async db => {
      if (!d.allowLastAdminRemoval) {
        await this.assertOrganizationStillHasAnotherAdmin({
          organization: d.organization,
          member: d.member
        });
      }

      await Fabric.fire('organization.member.deleted:before', d);

      let member = await db.organizationMember.update({
        where: { oid: d.member.oid },
        data: {
          status: 'deleted',
          deletedAt: new Date()
        },
        include
      });

      await Fabric.fire('organization.member.deleted:after', {
        organization: d.organization,
        member,
        auditScope: d.auditScope
      });

      // A deleted member keeps its row and carries a status, so the copy is an update like any other.
      await addAwaitedAfterTransactionHook(() =>
        metorialResourceService.syncOrganizationMember(member)
      );

      return member;
    });
  }

  async getOrganizationMemberById(d: { organization: Organization; memberId: string }) {
    let member = await db.organizationMember.findFirst({
      where: {
        organizationOid: d.organization.oid,

        OR: [{ id: d.memberId }, { user: { id: d.memberId } }]
      },
      include
    });
    if (!member) throw new ServiceError(notFoundError('organization_member', d.memberId));

    return member;
  }

  async listOrganizationMembers(d: { organization: Organization; teamIds?: string[] }) {
    let teams = d.teamIds
      ? await db.team.findMany({
          where: {
            organizationOid: d.organization.oid,
            OR: [{ id: { in: d.teamIds } }, { slug: { in: d.teamIds } }]
          }
        })
      : undefined;

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.organizationMember.findMany({
            ...opts,
            where: {
              organizationOid: d.organization.oid,
              status: 'active',

              user: {
                type: { not: 'system' }
              },

              actor: teams
                ? {
                    teams: {
                      some: {
                        teamOid: { in: teams.map(t => t.oid) }
                      }
                    }
                  }
                : undefined
            },
            include
          })
      )
    );
  }
}

export let organizationMemberService = Service.create(
  'organizationMemberService',
  () => new OrganizationMemberService()
).build();
