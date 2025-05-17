import { Context } from '@metorial/context';
import {
  db,
  ID,
  Organization,
  OrganizationActor,
  OrganizationMember,
  OrganizationMemberRole,
  User,
  withTransaction
} from '@metorial/db';
import { conflictError, forbiddenError, notFoundError, ServiceError } from '@metorial/error';
import { Fabric } from '@metorial/fabric';
import { Paginator } from '@metorial/pagination';
import { Service } from '@metorial/service';
import { organizationActorService } from './organizationActor';

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

  async createOrganizationMember(d: {
    user: User;
    organization: Organization;
    input: {
      role: OrganizationMemberRole;
    };
    context: Context;
    performedBy: { type: 'user'; user: User } | { type: 'actor'; actor: OrganizationActor };
  }) {
    return withTransaction(async db => {
      let actor = await organizationActorService.createOrganizationActor({
        input: {
          type: 'member',
          name: d.user.name,
          email: d.user.email,
          image: d.user.image
        },
        performedBy: { type: 'user', user: d.user },
        organization: d.organization,
        context: d.context
      });

      await Fabric.fire('organization.member.created:before', {
        actor,
        user: d.user,
        organization: d.organization,
        performedBy: d.performedBy.type == 'user' ? actor : d.performedBy.actor
      });

      let existingMember = await db.organizationMember.findFirst({
        where: {
          organizationOid: d.organization.oid,
          userOid: d.user.oid
        }
      });
      if (existingMember) {
        if (existingMember.status == 'active') {
          throw new ServiceError(
            conflictError({
              message: 'User is already a member of the organization'
            })
          );
        }
      }

      let member = existingMember
        ? await db.organizationMember.update({
            where: { oid: existingMember.oid },
            data: {
              status: 'active',
              role: d.input.role,
              organizationOid: d.organization.oid,
              actorOid: actor.oid,
              userOid: d.user.oid
            },
            include: {
              actor: { include: { organization: true } },
              organization: true,
              user: true
            }
          })
        : await db.organizationMember.create({
            data: {
              id: await ID.generateId('organizationMember'),
              status: 'active',
              role: d.input.role,
              organizationOid: d.organization.oid,
              actorOid: actor.oid,
              userOid: d.user.oid
            },
            include: {
              actor: { include: { organization: true } },
              organization: true,
              user: true
            }
          });

      await Fabric.fire('organization.member.created:after', {
        ...d,
        actor,
        member,
        performedBy: d.performedBy.type == 'user' ? actor : d.performedBy.actor
      });

      return member;
    });
  }

  async updateOrganizationMember(d: {
    organization: Organization;
    member: OrganizationMember;
    input: {
      role?: OrganizationMemberRole;
    };
    context: Context;
    performedBy: OrganizationActor;
  }) {
    await this.ensureOrganizationMemberActive(d.member);

    return withTransaction(async db => {
      await Fabric.fire('organization.member.updated:before', {
        ...d,
        performedBy: d.performedBy
      });

      let member = await db.organizationMember.update({
        where: { oid: d.member.oid },
        data: {
          role: d.input.role
        },
        include: {
          actor: { include: { organization: true } },
          organization: true,
          user: true
        }
      });

      await Fabric.fire('organization.member.updated:after', {
        ...d,
        member,
        performedBy: d.performedBy
      });

      return member;
    });
  }

  async deleteOrganizationMember(d: {
    organization: Organization;
    member: OrganizationMember;
    context: Context;
    performedBy: OrganizationActor;
  }) {
    await this.ensureOrganizationMemberActive(d.member);

    return withTransaction(async db => {
      await Fabric.fire('organization.member.deleted:before', {
        ...d,
        performedBy: d.performedBy
      });

      let member = await db.organizationMember.update({
        where: { oid: d.member.oid },
        data: {
          status: 'deleted',
          deletedAt: new Date()
        },
        include: {
          actor: { include: { organization: true } },
          organization: true,
          user: true
        }
      });

      await Fabric.fire('organization.member.deleted:after', {
        ...d,
        member,
        performedBy: d.performedBy
      });

      return member;
    });
  }

  async getOrganizationMemberById(d: { organization: Organization; memberId: string }) {
    let member = await db.organizationMember.findFirst({
      where: {
        organizationOid: d.organization.oid,

        OR: [{ id: d.memberId }, { user: { id: d.memberId } }]
      },
      include: {
        actor: { include: { organization: true } },
        organization: true,
        user: true
      }
    });
    if (!member) throw new ServiceError(notFoundError('organization_member', d.memberId));

    return member;
  }

  async listOrganizationMembers(d: { organization: Organization }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.organizationMember.findMany({
            ...opts,
            where: {
              organizationOid: d.organization.oid,
              status: 'active'
            },
            include: {
              actor: { include: { organization: true } },
              organization: true,
              user: true
            }
          })
      )
    );
  }
}

export let organizationMemberService = Service.create(
  'organizationMemberService',
  () => new OrganizationMemberService()
).build();
