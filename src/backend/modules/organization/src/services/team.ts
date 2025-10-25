import { Context } from '@metorial/context';
import {
  db,
  ID,
  Instance,
  Organization,
  OrganizationActor,
  Project,
  Team,
  TeamRole,
  User,
  withTransaction
} from '@metorial/db';
import { badRequestError, notFoundError, ServiceError } from '@metorial/error';
import { Fabric } from '@metorial/fabric';
import { Paginator } from '@metorial/pagination';
import { Service } from '@metorial/service';
import { createSlugGenerator } from '@metorial/slugify';

let getTeamSlug = createSlugGenerator(
  async (slug, d: { organization: Organization }) =>
    !(await db.team.findFirst({ where: { slug, organizationOid: d.organization.oid } }))
);

let include = {
  organization: true,
  projects: { include: { project: true } },
  assignments: {
    include: {
      teamProject: true,
      teamRole: true,
      project: true
    }
  }
};

class teamServiceImpl {
  async createTeam(d: {
    organization: Organization;
    performedBy: OrganizationActor;
    context: Context;
    input: {
      name: string;
      description?: string;
    };
  }) {
    return withTransaction(async db => {
      await Fabric.fire('organization.team.created:before', d);

      await db.organization.update({
        where: { oid: d.organization.oid },
        data: {
          enforceTeamAccess: true
        }
      });

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
        ...d,
        team,
        performedBy: d.performedBy
      });

      return team;
    });
  }

  async updateTeam(d: {
    team: Team;
    organization: Organization;
    performedBy: OrganizationActor;
    context: Context;
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
        ...d,
        team,
        performedBy: d.performedBy
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

  async setTeamProjectAccess(d: {
    team: Team;
    project: Project;
    organization: Organization;
    performedBy: OrganizationActor;
    teamRoles: TeamRole[];
  }) {
    return withTransaction(async db => {
      let teamProject = await db.teamProject.findFirst({
        where: {
          teamOid: d.team.oid,
          projectOid: d.project.oid
        }
      });

      if (!teamProject) {
        await Fabric.fire('organization.team.project.assigned:before', {
          ...d
        });

        teamProject = await db.teamProject.create({
          data: {
            id: await ID.generateId('teamProject'),
            teamOid: d.team.oid,
            projectOid: d.project.oid
          }
        });

        await Fabric.fire('organization.team.project.assigned:after', {
          ...d,
          teamProject,
          performedBy: d.performedBy
        });
      }

      let existingAssignmentsToRemove = await db.teamProjectRoleAssignment.findMany({
        where: {
          teamProjectOid: teamProject.oid,
          teamRoleOid: {
            notIn: d.teamRoles.map(tr => tr.oid)
          }
        }
      });
      let existingAssignmentsToKeep = await db.teamProjectRoleAssignment.findMany({
        where: {
          teamProjectOid: teamProject.oid,
          teamRoleOid: {
            in: d.teamRoles.map(tr => tr.oid)
          }
        }
      });

      let remainingRolesToAdd = d.teamRoles.filter(
        tr => !existingAssignmentsToKeep.find(ear => ear.teamRoleOid === tr.oid)
      );

      if (existingAssignmentsToRemove.length > 0) {
        for (let assignment of existingAssignmentsToRemove) {
          await Fabric.fire('organization.team.project.unassigned:before', {
            ...d,
            teamProject
          });

          await db.teamProjectRoleAssignment.delete({
            where: { oid: assignment.oid }
          });

          await Fabric.fire('organization.team.project.unassigned:after', {
            ...d,
            teamProject,
            performedBy: d.performedBy
          });
        }
      }

      for (let role of remainingRolesToAdd) {
        await Fabric.fire('organization.team.project.assigned:before', {
          ...d
        });

        await db.teamProjectRoleAssignment.create({
          data: {
            id: await ID.generateId('teamRoleAssignment'),
            teamProjectOid: teamProject.oid,
            teamRoleOid: role.oid,
            projectOid: d.project.oid,
            teamOid: d.team.oid
          }
        });

        await Fabric.fire('organization.team.project.assigned:after', {
          ...d,
          teamProject,
          performedBy: d.performedBy
        });
      }

      return teamProject;
    });
  }

  async removeTeamProjectAccess(d: {
    team: Team;
    project: Project;
    organization: Organization;
    performedBy: OrganizationActor;
  }) {
    return withTransaction(async db => {
      let teamProject = await db.teamProject.findFirst({
        where: {
          teamOid: d.team.oid,
          projectOid: d.project.oid
        }
      });
      if (!teamProject) {
        throw new ServiceError(
          badRequestError({
            message: 'The team does not have access to the specified project'
          })
        );
      }

      await Fabric.fire('organization.team.project.unassigned:before', {
        ...d,
        teamProject
      });

      await db.teamProjectRoleAssignment.deleteMany({
        where: {
          teamProjectOid: teamProject.oid
        }
      });

      await db.teamProject.delete({
        where: { oid: teamProject.oid }
      });

      await Fabric.fire('organization.team.project.unassigned:after', {
        ...d,
        teamProject,
        performedBy: d.performedBy
      });
    });
  }

  async assignActorToTeam(d: {
    team: Team;
    actor: OrganizationActor;
    organization: Organization;
    performedBy: OrganizationActor;
    context: Context;
  }) {
    return withTransaction(async db => {
      await Fabric.fire('organization.team.member.added:before', {
        ...d
      });

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
        ...d,
        member: teamMember,
        performedBy: d.performedBy
      });

      return teamMember;
    });
  }

  async removeActorFromTeam(d: {
    team: Team;
    actor: OrganizationActor;
    organization: Organization;
    performedBy: OrganizationActor;
    context: Context;
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
        ...d,
        member: teamMember
      });

      await db.teamMember.delete({
        where: { oid: teamMember.oid }
      });

      await Fabric.fire('organization.team.member.removed:after', {
        ...d,
        member: teamMember,
        performedBy: d.performedBy
      });
    });
  }

  async getTeamAccessForInstance(d: {
    instance: Instance;
    organization: Organization;
    for:
      | {
          type: 'actor';
          actor: OrganizationActor;
        }
      | {
          type: 'user';
          user: User;
        };
  }) {
    let teamMemberships = await db.teamMember.findMany({
      where: {
        team: {
          organizationOid: d.organization.oid
        },

        ...(d.for.type == 'actor'
          ? { organizationActorOid: d.for.actor.oid }
          : {
              organizationActor: {
                member: {
                  userOid: d.for.user.oid
                }
              }
            })
      },
      include: {
        team: {
          include: {
            projects: {
              where: {
                projectOid: d.instance.projectOid
              },
              include: {
                roles: {
                  include: {
                    teamRole: true
                  }
                }
              }
            }
          }
        }
      }
    });

    let scopes = teamMemberships.flatMap(tm =>
      tm.team.projects.flatMap(tp => tp.roles.flatMap(r => r.teamRole.scopes))
    );

    return { scopes };
  }
}

export let teamService = Service.create('teamService', () => new teamServiceImpl()).build();
