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

let include = {
  actor: {
    include: {
      organization: true,
      teams: { include: { team: true } }
    }
  },
  organization: true,
  user: true
};

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
      let existingMember = await db.organizationMember.findFirst({
        where: {
          organizationOid: d.organization.oid,
          userOid: d.user.oid
        },
        include: {
          actor: true
        }
      });
      if (existingMember && existingMember.status == 'active') {
        throw new ServiceError(
          conflictError({
            message: 'User is already a member of the organization'
          })
        );
      }

      let actor =
        existingMember?.actor ??
        (await organizationActorService.createOrganizationActor({
          input: {
            type: 'member',
            name: d.user.name,
            email: d.user.email,
            image: d.user.image
          },
          performedBy: { type: 'user', user: d.user },
          organization: d.organization,
          context: d.context
        }));

      await Fabric.fire('organization.member.created:before', {
        actor,
        user: d.user,
        organization: d.organization,
        performedBy: d.performedBy.type == 'user' ? actor : d.performedBy.actor
      });

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
            include
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
            include
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
        include
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
        include
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
