import { forbiddenError, ServiceError } from '@metorial/error';
import { teamRoleService } from '@metorial/module-organization';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { checkAccess } from '../../middleware/checkAccess';
import {
  organizationGroup,
  organizationManagementPath
} from '../../middleware/organizationGroup';
import { teamRolePresenter } from '../../presenters';

export let teamRoleManagementController = Controller.create(
  {
    name: 'Organization Team',
    description: 'Read and write team information'
  },
  {
    list: organizationGroup
      .get(organizationManagementPath('team-roles', 'teams.roles.list'), {
        name: 'List organization teams',
        description: 'List all organization teams'
      })
      .use(checkAccess({ possibleScopes: ['organization.team:read'] }))
      .outputList(teamRolePresenter)
      .query('default', Paginator.validate())
      .do(async ctx => {
        let paginator = await teamRoleService.listTeamRoles({
          organization: ctx.organization
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, teamRole => teamRolePresenter.present({ teamRole }));
      }),

    get: organizationGroup
      .get(organizationManagementPath('team-roles/:teamRoleId', 'teams.roles.get'), {
        name: 'Get team',
        description: 'Get the information of a specific team'
      })
      .use(checkAccess({ possibleScopes: ['organization.team:read'] }))
      .output(teamRolePresenter)
      .do(async ctx => {
        let teamRole = await teamRoleService.getTeamRoleById({
          organization: ctx.organization,
          teamRoleId: ctx.params.teamRoleId
        });

        return teamRolePresenter.present({ teamRole });
      }),

    update: organizationGroup
      .post(organizationManagementPath('team-roles/:teamRoleId', 'teams.roles.update'), {
        name: 'Update team',
        description: 'Update the role of an team'
      })
      .use(checkAccess({ possibleScopes: ['organization.team:write'] }))
      .body(
        'default',
        v.object({
          name: v.optional(v.string()),
          description: v.optional(v.string()),
          permissions: v.optional(v.array(v.string()))
        })
      )
      .output(teamRolePresenter)
      .do(async ctx => {
        if (ctx.member?.role == 'member') {
          throw new ServiceError(
            forbiddenError({
              message: 'You are not permitted to manage organization teams'
            })
          );
        }

        let teamRole = await teamRoleService.getTeamRoleById({
          organization: ctx.organization,
          teamRoleId: ctx.params.teamRoleId
        });

        teamRole = await teamRoleService.updateTeamRole({
          teamRole,
          organization: ctx.organization,
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            permissions: ctx.body.permissions
          },
          context: ctx.context,
          performedBy: ctx.actor
        });

        return teamRolePresenter.present({ teamRole });
      }),

    create: organizationGroup
      .post(organizationManagementPath('team-roles', 'teams.roles.create'), {
        name: 'Create organization team',
        description: 'Create a new organization team'
      })
      .use(checkAccess({ possibleScopes: ['organization.team:write'] }))
      .body(
        'default',
        v.object({
          name: v.string(),
          description: v.optional(v.string()),
          permissions: v.optional(v.array(v.string()))
        })
      )
      .output(teamRolePresenter)
      .do(async ctx => {
        if (ctx.member?.role == 'member') {
          throw new ServiceError(
            forbiddenError({
              message: 'You are not permitted to manage organization teams'
            })
          );
        }

        let teamRole = await teamRoleService.createTeamRole({
          input: {
            name: ctx.body.name,
            description: ctx.body.description,
            permissions: ctx.body.permissions
          },
          organization: ctx.organization,
          context: ctx.context,
          performedBy: ctx.actor
        });

        return teamRolePresenter.present({ teamRole });
      })
  }
);
