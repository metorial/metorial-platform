import { forbiddenError, ServiceError } from '@metorial/error';
import {
  organizationActorService,
  projectService,
  teamRoleService,
  teamService
} from '@metorial/module-organization';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { checkAccess } from '../../middleware/checkAccess';
import { hasFlags } from '../../middleware/hasFlags';
import {
  organizationGroup,
  organizationManagementPath
} from '../../middleware/organizationGroup';
import { teamPresenter } from '../../presenters';

export let teamManagementController = Controller.create(
  {
    name: 'Organization Team',
    description: 'Read and write team information'
  },
  {
    list: organizationGroup
      .get(organizationManagementPath('teams', 'teams.list'), {
        name: 'List organization teams',
        description: 'List all organization teams'
      })
      .use(checkAccess({ possibleScopes: ['organization.team:read'] }))
      .use(hasFlags(['paid-advanced-roles']))
      .outputList(teamPresenter)
      .query('default', Paginator.validate())
      .do(async ctx => {
        let paginator = await teamService.listTeams({
          organization: ctx.organization
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, team => teamPresenter.present({ team }));
      }),

    get: organizationGroup
      .get(organizationManagementPath('teams/:teamId', 'teams.get'), {
        name: 'Get team',
        description: 'Get the information of a specific team'
      })
      .use(checkAccess({ possibleScopes: ['organization.team:read'] }))
      .use(hasFlags(['paid-advanced-roles']))
      .output(teamPresenter)
      .do(async ctx => {
        let team = await teamService.getTeamById({
          organization: ctx.organization,
          teamId: ctx.params.teamId
        });

        return teamPresenter.present({ team });
      }),

    update: organizationGroup
      .post(organizationManagementPath('teams/:teamId', 'teams.update'), {
        name: 'Update team',
        description: 'Update the role of an team'
      })
      .use(checkAccess({ possibleScopes: ['organization.team:write'] }))
      .use(hasFlags(['paid-advanced-roles']))
      .body(
        'default',
        v.object({
          name: v.optional(v.string()),
          description: v.optional(v.string())
        })
      )
      .output(teamPresenter)
      .do(async ctx => {
        if (ctx.member?.role == 'member') {
          throw new ServiceError(
            forbiddenError({
              message: 'You are not permitted to manage organization teams'
            })
          );
        }

        let team = await teamService.getTeamById({
          organization: ctx.organization,
          teamId: ctx.params.teamId
        });

        team = await teamService.updateTeam({
          team,
          organization: ctx.organization,
          input: {
            name: ctx.body.name,
            description: ctx.body.description
          },
          context: ctx.context,
          performedBy: ctx.actor
        });

        return teamPresenter.present({ team });
      }),

    create: organizationGroup
      .post(organizationManagementPath('teams', 'teams.create'), {
        name: 'Create organization team',
        description: 'Create a new organization team'
      })
      .use(checkAccess({ possibleScopes: ['organization.team:write'] }))
      .use(hasFlags(['paid-advanced-roles']))
      .body(
        'default',
        v.object({
          name: v.string(),
          description: v.optional(v.string())
        })
      )
      .output(teamPresenter)
      .do(async ctx => {
        if (ctx.member?.role == 'member') {
          throw new ServiceError(
            forbiddenError({
              message: 'You are not permitted to manage organization teams'
            })
          );
        }

        let team = await teamService.createTeam({
          input: {
            name: ctx.body.name,
            description: ctx.body.description
          },
          organization: ctx.organization,
          context: ctx.context,
          performedBy: ctx.actor
        });

        return teamPresenter.present({ team });
      }),

    setProject: organizationGroup
      .post(organizationManagementPath('teams/:teamId/projects', 'teams.projects.set'), {
        name: 'Set team projects',
        description: 'Set the projects assigned to a team'
      })
      .use(checkAccess({ possibleScopes: ['organization.team:write'] }))
      .use(hasFlags(['paid-advanced-roles']))
      .body(
        'default',
        v.object({
          project_id: v.string(),
          team_role_ids: v.array(v.string())
        })
      )
      .output(teamPresenter)
      .do(async ctx => {
        if (ctx.member?.role == 'member') {
          throw new ServiceError(
            forbiddenError({
              message: 'You are not permitted to manage organization teams'
            })
          );
        }

        let team = await teamService.getTeamById({
          organization: ctx.organization,
          teamId: ctx.params.teamId
        });
        let project = await projectService.getProjectById({
          organization: ctx.organization,
          projectId: ctx.body.project_id,
          actor: ctx.actor,
          member: ctx.member
        });

        let roles = await teamRoleService.getManyTeamRolesByIds({
          organization: ctx.organization,
          teamRoleIds: ctx.body.team_role_ids
        });

        await teamService.setTeamProjectAccess({
          team,
          organization: ctx.organization,
          project,
          teamRoles: roles,
          performedBy: ctx.actor
        });

        team = await teamService.getTeamById({
          organization: ctx.organization,
          teamId: ctx.params.teamId
        });

        return teamPresenter.present({ team });
      }),

    removeProject: organizationGroup
      .delete(
        organizationManagementPath(
          'teams/:teamId/projects/:projectId',
          'teams.projects.remove'
        ),
        {
          name: 'Remove team project',
          description: 'Remove a project from a team'
        }
      )
      .use(checkAccess({ possibleScopes: ['organization.team:write'] }))
      .use(hasFlags(['paid-advanced-roles']))
      .output(teamPresenter)
      .do(async ctx => {
        if (ctx.member?.role == 'member') {
          throw new ServiceError(
            forbiddenError({
              message: 'You are not permitted to manage organization teams'
            })
          );
        }

        let team = await teamService.getTeamById({
          organization: ctx.organization,
          teamId: ctx.params.teamId
        });
        let project = await projectService.getProjectById({
          organization: ctx.organization,
          projectId: ctx.params.projectId,
          actor: ctx.actor,
          member: ctx.member
        });

        await teamService.removeTeamProjectAccess({
          team,
          organization: ctx.organization,
          project,
          performedBy: ctx.actor
        });

        team = await teamService.getTeamById({
          organization: ctx.organization,
          teamId: ctx.params.teamId
        });

        return teamPresenter.present({ team });
      }),

    assignMember: organizationGroup
      .post(organizationManagementPath('teams/:teamId/members', 'teams.members.create'), {
        name: 'Assign member to team',
        description: 'Assign an organization member to a team'
      })
      .use(checkAccess({ possibleScopes: ['organization.team:write'] }))
      .use(hasFlags(['paid-advanced-roles']))
      .output(teamPresenter)
      .body(
        'default',
        v.object({
          actor_id: v.string()
        })
      )
      .do(async ctx => {
        if (ctx.member?.role == 'member') {
          throw new ServiceError(
            forbiddenError({
              message: 'You are not permitted to manage organization teams'
            })
          );
        }

        let team = await teamService.getTeamById({
          organization: ctx.organization,
          teamId: ctx.params.teamId
        });
        let actor = await organizationActorService.getOrganizationActorById({
          organization: ctx.organization,
          actorId: ctx.body.actor_id
        });

        await teamService.assignActorToTeam({
          team,
          organization: ctx.organization,
          actor,
          context: ctx.context,
          performedBy: ctx.actor
        });

        team = await teamService.getTeamById({
          organization: ctx.organization,
          teamId: ctx.params.teamId
        });

        return teamPresenter.present({ team });
      }),

    removeMember: organizationGroup
      .delete(
        organizationManagementPath('teams/:teamId/members/:actorId', 'teams.members.delete'),
        {
          name: 'Remove member from team',
          description: 'Remove an organization member from a team'
        }
      )
      .use(checkAccess({ possibleScopes: ['organization.team:write'] }))
      .use(hasFlags(['paid-advanced-roles']))
      .output(teamPresenter)
      .do(async ctx => {
        if (ctx.member?.role == 'member') {
          throw new ServiceError(
            forbiddenError({
              message: 'You are not permitted to manage organization teams'
            })
          );
        }

        let team = await teamService.getTeamById({
          organization: ctx.organization,
          teamId: ctx.params.teamId
        });
        let actor = await organizationActorService.getOrganizationActorById({
          organization: ctx.organization,
          actorId: ctx.params.actorId
        });

        await teamService.removeActorFromTeam({
          team,
          organization: ctx.organization,
          actor,
          context: ctx.context,
          performedBy: ctx.actor
        });

        team = await teamService.getTeamById({
          organization: ctx.organization,
          teamId: ctx.params.teamId
        });

        return teamPresenter.present({ team });
      })
  }
);
