import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { createSlugGenerator } from '@lowerdeck/slugify';
import type { AuditScope } from '@metorial/audit-scope';
import { db, ID, Organization, OrganizationActor, Team, withTransaction } from '@metorial/db';
import { Fabric } from '@metorial/fabric';

let getTeamSlug = createSlugGenerator(
  async (slug, d: { organization: Organization }) =>
    !(await db.team.findFirst({ where: { slug, organizationOid: d.organization.oid } }))
);

let include = {
  organization: true,
  projects: { include: { project: true } },
  policies: {
    include: {
      accessPolicy: true
    }
  }
};

class teamServiceImpl {
  async createTeam(d: {
    organization: Organization;
    auditScope: AuditScope;
    input: {
      name: string;
      description?: string;
    };
  }) {
    return withTransaction(async db => {
      await Fabric.fire('organization.team.created:before', d);

      let team = await db.team.create({
        data: {
          id: await ID.generateId('team'),
          slug: await getTeamSlug({ input: d.input.name }, { organization: d.organization }),
          name: d.input.name,
          description: d.input.description,
          organizationOid: d.organization.oid
        },
        include
      });

      await Fabric.fire('organization.team.created:after', {
        organization: d.organization,
        input: d.input,
        team,
        auditScope: d.auditScope
      });

      return team;
    });
  }

  async updateTeam(d: {
    team: Team;
    organization: Organization;
    auditScope: AuditScope;
    input: {
      name?: string;
      description?: string;
    };
  }) {
    return withTransaction(async db => {
      await Fabric.fire('organization.team.updated:before', d);

      let team = await db.team.update({
        where: { oid: d.team.oid },
        data: {
          name: d.input.name,
          description: d.input.description
        },
        include
      });

      await Fabric.fire('organization.team.updated:after', {
        organization: d.organization,
        input: d.input,
        team,
        previousTeam: d.team,
        auditScope: d.auditScope
      });

      return team;
    });
  }

  async getTeamById(d: { organization: Organization; teamId: string }) {
    let team = await db.team.findFirst({
      where: {
        OR: [{ id: d.teamId }, { slug: d.teamId }],
        organizationOid: d.organization.oid
      },
      include
    });
    if (!team) throw new ServiceError(notFoundError('team', d.teamId));

    return team;
  }

  async listTeams(d: { organization: Organization }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.team.findMany({
            ...opts,
            where: {
              organizationOid: d.organization.oid
            },
            include
          })
      )
    );
  }

  async assignActorToTeam(d: {
    team: Team;
    actor: OrganizationActor;
    organization: Organization;
    auditScope: AuditScope;
  }) {
    return withTransaction(async db => {
      await Fabric.fire('organization.team.member.added:before', d);

      let existingMembership = await db.teamMember.findFirst({
        where: {
          teamOid: d.team.oid,
          organizationActorOid: d.actor.oid
        }
      });
      if (existingMembership) return existingMembership;

      let teamMember = await db.teamMember.create({
        data: {
          id: await ID.generateId('teamMember'),
          teamOid: d.team.oid,
          organizationActorOid: d.actor.oid
        },
        include: {
          team: true,
          organizationActor: true
        }
      });

      await Fabric.fire('organization.team.member.added:after', {
        organization: d.organization,
        team: d.team,
        actor: d.actor,
        member: teamMember,
        auditScope: d.auditScope
      });

      return teamMember;
    });
  }

  async removeActorFromTeam(d: {
    team: Team;
    actor: OrganizationActor;
    organization: Organization;
    auditScope: AuditScope;
  }) {
    return withTransaction(async db => {
      let teamMember = await db.teamMember.findFirst({
        where: {
          teamOid: d.team.oid,
          organizationActorOid: d.actor.oid
        }
      });
      if (!teamMember) {
        throw new ServiceError(
          badRequestError({
            message: 'The actor is not a member of the specified team'
          })
        );
      }

      await Fabric.fire('organization.team.member.removed:before', {
        organization: d.organization,
        team: d.team,
        actor: d.actor,
        member: teamMember,
        auditScope: d.auditScope
      });

      await db.teamMember.delete({
        where: { oid: teamMember.oid }
      });

      await Fabric.fire('organization.team.member.removed:after', {
        organization: d.organization,
        team: d.team,
        actor: d.actor,
        member: teamMember,
        auditScope: d.auditScope
      });
    });
  }
}

export let teamService = Service.create('teamService', () => new teamServiceImpl()).build();
