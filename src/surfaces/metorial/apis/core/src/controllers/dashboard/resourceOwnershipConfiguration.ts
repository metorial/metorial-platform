import { badRequestError, ServiceError } from '@lowerdeck/error';
import { v } from '@lowerdeck/validation';
import { accessService } from '@metorial/module-access';
import {
  projectResourceOwnershipConfigurationService,
  projectService
} from '@metorial/module-organization';
import { projectResourceOwnershipConfigurationPresenter } from '@metorial/presenters';
import { Controller, Path } from '@metorial/rest';
import { checkAccess } from '../../middleware/checkAccess';
import { isDashboardGroup } from '../../middleware/isDashboard';
import { organizationGroup } from '../../middleware/organizationGroup';

export let dashboardResourceOwnershipConfigurationController = Controller.create(
  {
    name: 'Resource ownership configuration',
    description: 'Configure who can use resources owned by consumers in a project'
  },
  {
    get: organizationGroup
      .use(isDashboardGroup())
      .get(
        Path(
          '/dashboard/organizations/:organizationId/projects/:projectId/configure/resource-ownership',
          'dashboard.projects.configure.resource_ownership.get'
        ),
        {
          name: 'Get project resource ownership configuration',
          description: 'Get who can use consumer-owned resources in a project'
        }
      )
      .use(checkAccess({ possibleScopes: ['organization.project:read'] }))
      .output(projectResourceOwnershipConfigurationPresenter)
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
          await projectResourceOwnershipConfigurationService.getProjectResourceOwnershipConfiguration(
            { project }
          );

        return projectResourceOwnershipConfigurationPresenter.present({
          project,
          ...configuration
        });
      }),

    update: organizationGroup
      .use(isDashboardGroup())
      .patch(
        Path(
          '/dashboard/organizations/:organizationId/projects/:projectId/configure/resource-ownership',
          'dashboard.projects.configure.resource_ownership.update'
        ),
        {
          name: 'Update project resource ownership configuration',
          description: 'Update who can use consumer-owned resources in a project'
        }
      )
      .use(checkAccess({ possibleScopes: ['organization.project:manage'] }))
      .body(
        'default',
        v.object({
          allow_api_access_to_consumer_owned_resources: v.optional(
            v.boolean({
              description:
                'Whether API keys and service accounts can use resources owned by consumers'
            })
          ),
          allow_member_access_to_consumer_owned_resources: v.optional(
            v.boolean({
              description:
                'Whether organization members in the dashboard can use resources owned by consumers'
            })
          )
        })
      )
      .output(projectResourceOwnershipConfigurationPresenter)
      .do(async ctx => {
        if (
          ctx.body.allow_api_access_to_consumer_owned_resources === undefined &&
          ctx.body.allow_member_access_to_consumer_owned_resources === undefined
        ) {
          throw new ServiceError(
            badRequestError({
              message: 'At least one resource ownership configuration field must be provided'
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
          possibleScopes: ['organization.project:manage']
        });

        let configuration =
          await projectResourceOwnershipConfigurationService.updateProjectResourceOwnershipConfiguration(
            {
              project,
              organization: ctx.organization,
              auditScope: ctx.auditScope,
              input: {
                allowApiAccessToConsumerOwnedResources:
                  ctx.body.allow_api_access_to_consumer_owned_resources,
                allowMemberAccessToConsumerOwnedResources:
                  ctx.body.allow_member_access_to_consumer_owned_resources
              }
            }
          );

        return projectResourceOwnershipConfigurationPresenter.present({
          project,
          ...configuration
        });
      })
  }
);
