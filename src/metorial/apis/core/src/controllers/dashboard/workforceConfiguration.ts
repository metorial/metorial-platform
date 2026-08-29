import { badRequestError, ServiceError } from '@lowerdeck/error';
import { v } from '@lowerdeck/validation';
import { accessService } from '@metorial/module-access';
import { projectService } from '@metorial/module-organization';
import { projectWorkforceConfigurationService } from '@metorial/module-portal';
import { projectWorkforceConfigurationPresenter } from '@metorial/presenters';
import { Controller, Path } from '@metorial/rest';
import { checkAccess } from '../../middleware/checkAccess';
import { isDashboardGroup } from '../../middleware/isDashboard';
import { organizationGroup } from '../../middleware/organizationGroup';

export let dashboardWorkforceConfigurationController = Controller.create(
  {
    name: 'Workforce configuration',
    description: 'Configure project-level workforce settings'
  },
  {
    get: organizationGroup
      .use(isDashboardGroup())
      .get(
        Path(
          '/dashboard/organizations/:organizationId/projects/:projectId/configure/workforce',
          'dashboard.projects.configure.workforce.get'
        ),
        {
          name: 'Get project workforce configuration',
          description: 'Get workforce settings for a project'
        }
      )
      .use(checkAccess({ possibleScopes: ['organization.project:read'] }))
      .output(projectWorkforceConfigurationPresenter)
      .do(async ctx => {
        let project = await projectService.getProjectById({
          organization: ctx.organization,
          projectId: ctx.params.projectId,
          member: ctx.member,
          actor: ctx.actor
        });

        await accessService.checkTargetAccess({
          authInfo: ctx.auth,
          organization: ctx.organization,
          member: ctx.member,
          project,
          possibleScopes: ['organization.project:read']
        });

        await projectWorkforceConfigurationService.getProjectWorkforceConfiguration({
          project
        });
        return projectWorkforceConfigurationPresenter.present({ project });
      }),

    update: organizationGroup
      .use(isDashboardGroup())
      .patch(
        Path(
          '/dashboard/organizations/:organizationId/projects/:projectId/configure/workforce',
          'dashboard.projects.configure.workforce.update'
        ),
        {
          name: 'Update project workforce configuration',
          description: 'Update workforce settings for a project'
        }
      )
      .use(checkAccess({ possibleScopes: ['organization.project:write'] }))
      .body(
        'default',
        v.object({
          auto_add_organization_members_to_portals: v.optional(v.boolean())
        })
      )
      .output(projectWorkforceConfigurationPresenter)
      .do(async ctx => {
        if (ctx.body.auto_add_organization_members_to_portals === undefined) {
          throw new ServiceError(
            badRequestError({
              message: 'At least one workforce configuration field must be provided'
            })
          );
        }

        let project = await projectService.getProjectById({
          organization: ctx.organization,
          projectId: ctx.params.projectId,
          member: ctx.member,
          actor: ctx.actor
        });

        await accessService.checkTargetAccess({
          authInfo: ctx.auth,
          organization: ctx.organization,
          member: ctx.member,
          project,
          possibleScopes: ['organization.project:write']
        });

        await projectWorkforceConfigurationService.updateProjectWorkforceConfiguration({
          project,
          organization: ctx.organization,
          auditScope: ctx.auditScope,
          input: {
            autoAddOrganizationMembersToPortals:
              ctx.body.auto_add_organization_members_to_portals
          }
        });

        project = await projectService.getProjectById({
          organization: ctx.organization,
          projectId: project.id,
          member: ctx.member,
          actor: ctx.actor
        });

        return projectWorkforceConfigurationPresenter.present({ project });
      })
  }
);
