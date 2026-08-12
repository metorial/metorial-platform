import { badRequestError, ServiceError } from '@lowerdeck/error';
import { v } from '@lowerdeck/validation';
import { accessService } from '@metorial/module-access';
import { projectRetentionService, projectService } from '@metorial/module-organization';
import { Controller, Path } from '@metorial/rest';
import { checkAccess } from '../../middleware/checkAccess';
import { isDashboardGroup } from '../../middleware/isDashboard';
import { organizationGroup } from '../../middleware/organizationGroup';
import { projectRetentionPresenter } from '@metorial/presenters';

let logRetentionInDaysValidator = v.optional(
  v.number({ modifiers: [v.positive(), v.integer(), v.minValue(1), v.maxValue(365)] })
);

export let dashboardProjectConfigurationController = Controller.create(
  {
    name: 'Project configuration',
    description: 'Configure project-level settings'
  },
  {
    getRetention: organizationGroup
      .use(isDashboardGroup())
      .get(
        Path(
          '/dashboard/organizations/:organizationId/projects/:projectId/configure/retention',
          'dashboard.projects.configure.retention.get'
        ),
        {
          name: 'Get project retention configuration',
          description: 'Get log retention settings for a project'
        }
      )
      .use(checkAccess({ possibleScopes: ['organization.project:read'] }))
      .output(projectRetentionPresenter)
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

        await projectRetentionService.getProjectRetention({ project });

        return projectRetentionPresenter.present({ project });
      }),

    updateRetention: organizationGroup
      .use(isDashboardGroup())
      .patch(
        Path(
          '/dashboard/organizations/:organizationId/projects/:projectId/configure/retention',
          'dashboard.projects.configure.retention.update'
        ),
        {
          name: 'Update project retention configuration',
          description: 'Update log retention settings for a project'
        }
      )
      .use(checkAccess({ possibleScopes: ['organization.project:write'] }))
      .body(
        'default',
        v.object({
          log_retention_in_days: logRetentionInDaysValidator,
          enforce_session_expiry: v.optional(v.boolean())
        })
      )
      .output(projectRetentionPresenter)
      .do(async ctx => {
        if (
          ctx.body.log_retention_in_days === undefined &&
          ctx.body.enforce_session_expiry === undefined
        ) {
          throw new ServiceError(
            badRequestError({
              message: 'At least one retention field must be provided'
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

        project = await projectRetentionService.updateProjectRetention({
          project,
          organization: ctx.organization,
          performedBy: ctx.actor,
          context: ctx.context,
          input: {
            logRetentionInDays: ctx.body.log_retention_in_days,
            enforceSessionExpiry: ctx.body.enforce_session_expiry
          }
        });

        return projectRetentionPresenter.present({ project });
      })
  }
);
