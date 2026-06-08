import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import {
  accessPolicyAssignmentService,
  accessPolicyService,
  organizationActorService,
  teamService
} from '@metorial/module-organization';
import { Controller } from '@metorial/rest';
import { checkAccess } from '../../../middleware/checkAccess';
import { hasFlags } from '../../../middleware/hasFlags';
import {
  organizationGroup,
  organizationManagementPath
} from '../../../middleware/organizationGroup';
import { teamPresenter } from '../../../presenters';

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
      }),

    assignPolicy: organizationGroup
      .post(organizationManagementPath('teams/:teamId/policies', 'teams.policies.create'), {
        name: 'Assign policy to team',
        description: 'Assign an access policy to a team'
      })
      .use(checkAccess({ possibleScopes: ['organization.access_policy:write'] }))
      .body(
        'default',
        v.object({
          access_policy_id: v.string()
        })
      )
      .output(teamPresenter)
      .do(async ctx => {
        let team = await teamService.getTeamById({
          organization: ctx.organization,
          teamId: ctx.params.teamId
        });
        let accessPolicy = await accessPolicyService.getAccessPolicyById({
          organization: ctx.organization,
          accessPolicyId: ctx.body.access_policy_id
        });

        await accessPolicyAssignmentService.assignAccessPolicyToTeam({
          organization: ctx.organization,
          team,
          accessPolicy,
          performedBy: ctx.actor,
          context: ctx.context
        });

        team = await teamService.getTeamById({
          organization: ctx.organization,
          teamId: ctx.params.teamId
        });

        return teamPresenter.present({ team });
      }),

    removePolicy: organizationGroup
      .delete(
        organizationManagementPath(
          'teams/:teamId/policies/:accessPolicyId',
          'teams.policies.delete'
        ),
        {
          name: 'Remove policy from team',
          description: 'Remove an access policy from a team'
        }
      )
      .use(checkAccess({ possibleScopes: ['organization.access_policy:write'] }))
      .output(teamPresenter)
      .do(async ctx => {
        let team = await teamService.getTeamById({
          organization: ctx.organization,
          teamId: ctx.params.teamId
        });
        let accessPolicy = await accessPolicyService.getAccessPolicyById({
          organization: ctx.organization,
          accessPolicyId: ctx.params.accessPolicyId
        });

        await accessPolicyAssignmentService.removeAccessPolicyFromTeam({
          organization: ctx.organization,
          team,
          accessPolicy,
          performedBy: ctx.actor,
          context: ctx.context
        });

        team = await teamService.getTeamById({
          organization: ctx.organization,
          teamId: ctx.params.teamId
        });

        return teamPresenter.present({ team });
      })
  }
);
