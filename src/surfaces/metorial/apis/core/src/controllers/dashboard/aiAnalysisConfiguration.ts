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
    description:
      'Configure Metorial Assistant access and AI-based security analysis for a project'
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
          description: 'Get Metorial Assistant and AI-based analysis settings for a project'
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
          description: 'Configure Metorial Assistant and AI-based analysis for a project'
        }
      )
      .use(checkAccess({ possibleScopes: ['organization.project:manage'] }))
      .body(
        'default',
        v.object({
          assistant_enabled: v.optional(
            v.boolean({
              description:
                'Whether users may use Metorial Assistant in this project. Reduced Subprocessors always disables assistant access.',
              examples: [true]
            })
          ),
          ai_analysis_enabled: v.optional(
            v.boolean({
              description:
                'Whether Metorial may analyze this project with AI to produce security reviews.',
              examples: [true]
            })
          ),
          usage_reviews_enabled: v.optional(
            v.boolean({
              description:
                'Whether Metorial may use aggregated, non-content usage data of this project to produce usage-based security reviews of the providers it uses',
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
              assistantEnabled: ctx.body.assistant_enabled,
              aiAnalysisEnabled: ctx.body.ai_analysis_enabled,
              usageReviewsEnabled: ctx.body.usage_reviews_enabled,
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
