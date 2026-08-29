import { badRequestError, ServiceError } from '@lowerdeck/error';
import { v } from '@lowerdeck/validation';
import { accessService } from '@metorial/module-access';
import {
  projectDataRetentionConfigurationService,
  projectService
} from '@metorial/module-organization';
import { projectDataRetentionConfigurationPresenter } from '@metorial/presenters';
import { Controller, Path } from '@metorial/rest';
import { checkAccess } from '../../middleware/checkAccess';
import { isDashboardGroup } from '../../middleware/isDashboard';
import { organizationGroup } from '../../middleware/organizationGroup';

let dataRetentionLevelValidator = v.optional(
  v.enumOf(['full', 'intent_only', 'none'], {
    description:
      'How much message data to store. `full` stores message contents and tool calls. `intent_only` stores tool names and operation descriptions but no message contents. `none` stores sessions and connections only.'
  })
);

export let dashboardDataRetentionConfigurationController = Controller.create(
  {
    name: 'Data retention configuration',
    description: 'Configure how much integration message data a project stores'
  },
  {
    get: organizationGroup
      .use(isDashboardGroup())
      .get(
        Path(
          '/dashboard/organizations/:organizationId/projects/:projectId/configure/data-retention',
          'dashboard.projects.configure.data_retention.get'
        ),
        {
          name: 'Get project data retention configuration',
          description: 'Get message data retention settings for a project'
        }
      )
      .use(checkAccess({ possibleScopes: ['organization.project:read'] }))
      .output(projectDataRetentionConfigurationPresenter)
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
          await projectDataRetentionConfigurationService.getProjectDataRetentionConfiguration({
            project
          });

        return projectDataRetentionConfigurationPresenter.present({
          project,
          ...configuration
        });
      }),

    update: organizationGroup
      .use(isDashboardGroup())
      .patch(
        Path(
          '/dashboard/organizations/:organizationId/projects/:projectId/configure/data-retention',
          'dashboard.projects.configure.data_retention.update'
        ),
        {
          name: 'Update project data retention configuration',
          description: 'Update message data retention settings for a project'
        }
      )
      .use(checkAccess({ possibleScopes: ['organization.project:write'] }))
      .body(
        'default',
        v.object({
          data_retention_level: dataRetentionLevelValidator,
          store_tool_call_attachments: v.optional(v.boolean()),
          collect_errors: v.optional(v.boolean())
        })
      )
      .output(projectDataRetentionConfigurationPresenter)
      .do(async ctx => {
        if (
          ctx.body.data_retention_level === undefined &&
          ctx.body.store_tool_call_attachments === undefined &&
          ctx.body.collect_errors === undefined
        ) {
          throw new ServiceError(
            badRequestError({
              message: 'At least one data retention configuration field must be provided'
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
          await projectDataRetentionConfigurationService.updateProjectDataRetentionConfiguration(
            {
              project,
              organization: ctx.organization,
              auditScope: ctx.auditScope,
              input: {
                dataRetentionLevel: ctx.body.data_retention_level,
                storeToolCallAttachments: ctx.body.store_tool_call_attachments,
                collectErrors: ctx.body.collect_errors
              }
            }
          );

        return projectDataRetentionConfigurationPresenter.present({
          project,
          ...configuration
        });
      })
  }
);
