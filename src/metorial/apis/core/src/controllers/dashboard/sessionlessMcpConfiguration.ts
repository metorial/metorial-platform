import { v } from '@lowerdeck/validation';
import { accessService } from '@metorial/module-access';
import {
  projectService,
  projectSessionlessMcpConfigurationService
} from '@metorial/module-organization';
import { projectSessionlessMcpConfigurationPresenter } from '@metorial/presenters';
import { Controller, Path } from '@metorial/rest';
import { checkAccess } from '../../middleware/checkAccess';
import { isDashboardGroup } from '../../middleware/isDashboard';
import { organizationGroup } from '../../middleware/organizationGroup';

export let dashboardSessionlessMcpConfigurationController = Controller.create(
  {
    name: 'Sessionless MCP configuration',
    description: 'Configure whether a project accepts sessionless MCP connections'
  },
  {
    get: organizationGroup
      .use(isDashboardGroup())
      .get(
        Path(
          '/dashboard/organizations/:organizationId/projects/:projectId/configure/sessionless-mcp',
          'dashboard.projects.configure.sessionless_mcp.get'
        ),
        {
          name: 'Get project sessionless MCP configuration',
          description: 'Get the sessionless MCP setting for a project'
        }
      )
      .use(checkAccess({ possibleScopes: ['organization.project:read'] }))
      .output(projectSessionlessMcpConfigurationPresenter)
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
          await projectSessionlessMcpConfigurationService.getProjectSessionlessMcpConfiguration(
            { project }
          );

        return projectSessionlessMcpConfigurationPresenter.present({
          project,
          ...configuration
        });
      }),

    update: organizationGroup
      .use(isDashboardGroup())
      .patch(
        Path(
          '/dashboard/organizations/:organizationId/projects/:projectId/configure/sessionless-mcp',
          'dashboard.projects.configure.sessionless_mcp.update'
        ),
        {
          name: 'Update project sessionless MCP configuration',
          description: 'Enable or disable sessionless MCP connections for a project'
        }
      )
      .use(checkAccess({ possibleScopes: ['organization.project:write'] }))
      .body(
        'default',
        v.object({
          sessionless_mcp_enabled: v.boolean({
            description:
              'Whether MCP clients using the sessionless protocol can connect to this project',
            examples: [true]
          })
        })
      )
      .output(projectSessionlessMcpConfigurationPresenter)
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
          possibleScopes: ['organization.project:write']
        });

        let configuration =
          await projectSessionlessMcpConfigurationService.updateProjectSessionlessMcpConfiguration(
            {
              project,
              organization: ctx.organization,
              auditScope: ctx.auditScope,
              input: { sessionlessMcpEnabled: ctx.body.sessionless_mcp_enabled }
            }
          );

        return projectSessionlessMcpConfigurationPresenter.present({
          project,
          ...configuration
        });
      })
  }
);
