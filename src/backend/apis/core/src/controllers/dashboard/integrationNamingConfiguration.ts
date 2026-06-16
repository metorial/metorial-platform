import { badRequestError, ServiceError } from '@lowerdeck/error';
import { v } from '@lowerdeck/validation';
import { accessService } from '@metorial/module-access';
import {
  projectIntegrationNamingConfigurationService,
  projectService
} from '@metorial/module-organization';
import { Controller, Path } from '@metorial/rest';
import { checkAccess } from '../../middleware/checkAccess';
import { isDashboardGroup } from '../../middleware/isDashboard';
import { organizationGroup } from '../../middleware/organizationGroup';
import { projectIntegrationNamingConfigurationPresenter } from '../../presenters';

export let dashboardIntegrationNamingConfigurationController = Controller.create(
  {
    name: 'Integration naming configuration',
    description: 'Configure project-level integration naming settings'
  },
  {
    get: organizationGroup
      .use(isDashboardGroup())
      .get(
        Path(
          '/dashboard/organizations/:organizationId/projects/:projectId/configure/integration-naming',
          'dashboard.projects.configure.integration_naming.get'
        ),
        {
          name: 'Get project integration naming configuration',
          description: 'Get integration naming settings for a project'
        }
      )
      .use(checkAccess({ possibleScopes: ['organization.project:read'] }))
      .output(projectIntegrationNamingConfigurationPresenter)
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
          await projectIntegrationNamingConfigurationService.getProjectIntegrationNamingConfiguration(
            {
              project
            }
          );

        return projectIntegrationNamingConfigurationPresenter.present({
          project,
          ...configuration
        });
      }),

    update: organizationGroup
      .use(isDashboardGroup())
      .patch(
        Path(
          '/dashboard/organizations/:organizationId/projects/:projectId/configure/integration-naming',
          'dashboard.projects.configure.integration_naming.update'
        ),
        {
          name: 'Update project integration naming configuration',
          description: 'Update integration naming settings for a project'
        }
      )
      .use(checkAccess({ possibleScopes: ['organization.project:write'] }))
      .body(
        'default',
        v.object({
          use_integration_name_in_tool_names: v.optional(v.boolean())
        })
      )
      .output(projectIntegrationNamingConfigurationPresenter)
      .do(async ctx => {
        if (ctx.body.use_integration_name_in_tool_names === undefined) {
          throw new ServiceError(
            badRequestError({
              message: 'At least one integration naming configuration field must be provided'
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
          await projectIntegrationNamingConfigurationService.updateProjectIntegrationNamingConfiguration(
            {
              project,
              organization: ctx.organization,
              performedBy: ctx.actor,
              context: ctx.context,
              input: {
                useIntegrationNames: ctx.body.use_integration_name_in_tool_names
              }
            }
          );

        return projectIntegrationNamingConfigurationPresenter.present({
          project,
          ...configuration
        });
      })
  }
);
