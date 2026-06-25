import { badRequestError, ServiceError } from '@lowerdeck/error';
import { v } from '@lowerdeck/validation';
import { accessService } from '@metorial/module-access';
import {
  projectService,
  projectToolCallingConfigurationService
} from '@metorial/module-organization';
import { Controller, Path } from '@metorial/rest';
import { checkAccess } from '../../middleware/checkAccess';
import { isDashboardGroup } from '../../middleware/isDashboard';
import { organizationGroup } from '../../middleware/organizationGroup';
import { projectToolCallingConfigurationPresenter } from '../../presenters';

export let dashboardToolCallingConfigurationController = Controller.create(
  {
    name: 'Tool calling configuration',
    description: 'Configure project-level tool calling settings'
  },
  {
    get: organizationGroup
      .use(isDashboardGroup())
      .get(
        Path(
          '/dashboard/organizations/:organizationId/projects/:projectId/configure/tool-calling',
          'dashboard.projects.configure.tool_calling.get'
        ),
        {
          name: 'Get project tool calling configuration',
          description: 'Get tool calling settings for a project'
        }
      )
      .use(checkAccess({ possibleScopes: ['organization.project:read'] }))
      .output(projectToolCallingConfigurationPresenter)
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

        let configuration =
          await projectToolCallingConfigurationService.getProjectToolCallingConfiguration({
            project
          });

        return projectToolCallingConfigurationPresenter.present({
          project,
          ...configuration
        });
      }),

    update: organizationGroup
      .use(isDashboardGroup())
      .patch(
        Path(
          '/dashboard/organizations/:organizationId/projects/:projectId/configure/tool-calling',
          'dashboard.projects.configure.tool_calling.update'
        ),
        {
          name: 'Update project tool calling configuration',
          description: 'Update tool calling settings for a project'
        }
      )
      .use(checkAccess({ possibleScopes: ['organization.project:write'] }))
      .body(
        'default',
        v.object({
          collect_operation_description_for_tool_calls: v.optional(v.boolean())
        })
      )
      .output(projectToolCallingConfigurationPresenter)
      .do(async ctx => {
        if (ctx.body.collect_operation_description_for_tool_calls === undefined) {
          throw new ServiceError(
            badRequestError({
              message: 'At least one tool calling configuration field must be provided'
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

        let configuration =
          await projectToolCallingConfigurationService.updateProjectToolCallingConfiguration({
            project,
            organization: ctx.organization,
            performedBy: ctx.actor,
            context: ctx.context,
            input: {
              collectOperationDescriptionForToolCalls:
                ctx.body.collect_operation_description_for_tool_calls
            }
          });

        return projectToolCallingConfigurationPresenter.present({
          project,
          ...configuration
        });
      })
  }
);
