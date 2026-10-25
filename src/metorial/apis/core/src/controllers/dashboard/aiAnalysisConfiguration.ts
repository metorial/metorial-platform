import { v } from '@lowerdeck/validation';
import { accessService } from '@metorial/module-access';
import {
  projectService,
  projectAiAnalysisConfigurationService
} from '@metorial/module-organization';
import { projectAiAnalysisConfigurationPresenter } from '@metorial/presenters';
import { Controller, Path } from '@metorial/rest';
import { checkAccess } from '../../middleware/checkAccess';
import { isDashboardGroup } from '../../middleware/isDashboard';
import { organizationGroup } from '../../middleware/organizationGroup';

export let dashboardAiAnalysisConfigurationController = Controller.create(
  {
    name: 'AI analysis configuration',
    description: "Configure whether Metorial may analyze a project's custom providers with AI"
  },
  {
    get: organizationGroup
      .use(isDashboardGroup())
      .get(
        Path(
          '/dashboard/organizations/:organizationId/projects/:projectId/configure/ai-analysis',
          'dashboard.projects.configure.ai_analysis.get'
        ),
        {
          name: 'Get project AI analysis configuration',
          description: 'Get the AI-based analysis setting for a project'
        }
      )
      .use(checkAccess({ possibleScopes: ['organization.project:read'] }))
      .output(projectAiAnalysisConfigurationPresenter)
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
          await projectAiAnalysisConfigurationService.getProjectAiAnalysisConfiguration({
            project
          });

        return projectAiAnalysisConfigurationPresenter.present({
          project,
          ...configuration
        });
      }),

    update: organizationGroup
      .use(isDashboardGroup())
      .patch(
        Path(
          '/dashboard/organizations/:organizationId/projects/:projectId/configure/ai-analysis',
          'dashboard.projects.configure.ai_analysis.update'
        ),
        {
          name: 'Update project AI analysis configuration',
          description: 'Enable or disable AI-based analysis for a project'
        }
      )
      .use(checkAccess({ possibleScopes: ['organization.project:manage'] }))
      .body(
        'default',
        v.object({
          ai_analysis_enabled: v.optional(
            v.boolean({
              description:
                "Whether Metorial may analyze this project's custom providers with AI to produce security reviews",
              examples: [true]
            })
          ),
          skill_review_hold_pending: v.optional(
            v.boolean({
              description:
                'Whether skills still waiting for their AI security review are withheld when a skill configuration blocks failing skills',
              examples: [false]
            })
          )
        })
      )
      .output(projectAiAnalysisConfigurationPresenter)
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
          possibleScopes: ['organization.project:manage']
        });

        let configuration =
          await projectAiAnalysisConfigurationService.updateProjectAiAnalysisConfiguration({
            project,
            organization: ctx.organization,
            auditScope: ctx.auditScope,
            input: {
              aiAnalysisEnabled: ctx.body.ai_analysis_enabled,
              skillReviewHoldPending: ctx.body.skill_review_hold_pending
            }
          });

        return projectAiAnalysisConfigurationPresenter.present({
          project,
          ...configuration
        });
      })
  }
);
