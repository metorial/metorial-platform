import { badRequestError, ServiceError } from '@lowerdeck/error';
import { v } from '@lowerdeck/validation';
import { accessService } from '@metorial/module-access';
import {
  projectAuthConfigConfigurationService,
  projectService
} from '@metorial/module-organization';
import { Controller, Path } from '@metorial/rest';
import { checkAccess } from '../../middleware/checkAccess';
import { isDashboardGroup } from '../../middleware/isDashboard';
import { organizationGroup } from '../../middleware/organizationGroup';
import { projectAuthConfigConfigurationPresenter } from '../../presenters';

let consumerAuthClientRegistrationLimitValidator = v.optional(
  v.number({ modifiers: [v.positive(), v.integer(), v.minValue(1)] })
);

export let dashboardAuthConfigConfigurationController = Controller.create(
  {
    name: 'Auth config configuration',
    description: 'Configure project-level auth config settings'
  },
  {
    get: organizationGroup
      .use(isDashboardGroup())
      .get(
        Path(
          '/dashboard/organizations/:organizationId/projects/:projectId/configure/auth-config',
          'dashboard.projects.configure.auth_config.get'
        ),
        {
          name: 'Get project auth config configuration',
          description: 'Get auth config export/import settings for a project'
        }
      )
      .use(checkAccess({ possibleScopes: ['organization.project:read'] }))
      .output(projectAuthConfigConfigurationPresenter)
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
          await projectAuthConfigConfigurationService.getProjectAuthConfigConfiguration({
            project
          });

        return projectAuthConfigConfigurationPresenter.present({
          project,
          ...configuration
        });
      }),

    update: organizationGroup
      .use(isDashboardGroup())
      .patch(
        Path(
          '/dashboard/organizations/:organizationId/projects/:projectId/configure/auth-config',
          'dashboard.projects.configure.auth_config.update'
        ),
        {
          name: 'Update project auth config configuration',
          description: 'Update auth config export/import settings for a project'
        }
      )
      .use(checkAccess({ possibleScopes: ['organization.project:write'] }))
      .body(
        'default',
        v.object({
          allow_auth_config_export: v.optional(v.boolean()),
          allow_auth_config_import: v.optional(v.boolean()),
          consumer_auth_client_registrations_per_hour_limit:
            consumerAuthClientRegistrationLimitValidator,
          consumer_auth_client_registrations_per_minute_limit:
            consumerAuthClientRegistrationLimitValidator
        })
      )
      .output(projectAuthConfigConfigurationPresenter)
      .do(async ctx => {
        if (
          ctx.body.allow_auth_config_export === undefined &&
          ctx.body.allow_auth_config_import === undefined &&
          ctx.body.consumer_auth_client_registrations_per_hour_limit === undefined &&
          ctx.body.consumer_auth_client_registrations_per_minute_limit === undefined
        ) {
          throw new ServiceError(
            badRequestError({
              message: 'At least one auth config configuration field must be provided'
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
          await projectAuthConfigConfigurationService.updateProjectAuthConfigConfiguration({
            project,
            organization: ctx.organization,
            performedBy: ctx.actor,
            context: ctx.context,
            input: {
              allowAuthConfigExport: ctx.body.allow_auth_config_export,
              allowAuthConfigImport: ctx.body.allow_auth_config_import,
              consumerAuthClientRegistrationsPerHourLimit:
                ctx.body.consumer_auth_client_registrations_per_hour_limit,
              consumerAuthClientRegistrationsPerMinuteLimit:
                ctx.body.consumer_auth_client_registrations_per_minute_limit
            }
          });

        project = await projectService.getProjectById({
          organization: ctx.organization,
          projectId: project.id,
          member: ctx.member,
          actor: ctx.actor
        });

        return projectAuthConfigConfigurationPresenter.present({
          project,
          ...configuration
        });
      })
  }
);
