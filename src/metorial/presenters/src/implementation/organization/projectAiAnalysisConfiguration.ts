import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { projectAiAnalysisConfigurationType } from '../../types';

export let v1ProjectAiAnalysisConfigurationPresenter = Presenter.create(
  projectAiAnalysisConfigurationType
)
  .presenter(
    async ({ project, aiAnalysisEnabled, usageReviewsEnabled, skillReviewHoldPending }) => ({
      object: 'organization.project.ai_analysis_configuration' as const,

      project_id: project.id,
      ai_analysis_enabled: aiAnalysisEnabled,
      usage_reviews_enabled: usageReviewsEnabled,
      skill_review_hold_pending: skillReviewHoldPending,
      updated_at: project.updatedAt
    })
  )
  .schema(
    v.object({
      object: v.literal('organization.project.ai_analysis_configuration'),
      project_id: v.string({
        description: 'The ID of the project this configuration belongs to',
        examples: ['prj_0mm97hpoosQAcleJQRtajt']
      }),
      ai_analysis_enabled: v.boolean({
        description:
          'Whether Metorial may analyze this project with AI to produce security reviews.',
        examples: [true]
      }),
      usage_reviews_enabled: v.boolean({
        description:
          'Whether Metorial may use aggregated, non-content usage data of this project to produce usage-based security reviews of the providers it uses. Requires AI analysis to be enabled',
        examples: [true]
      }),
      skill_review_hold_pending: v.boolean({
        description:
          "Whether skills that are still waiting for their AI security review are withheld from syncs and exports when a skill configuration's security review policy is `block`",
        examples: [false]
      }),
      updated_at: v.date({
        description: 'The time the project was last updated'
      })
    })
  )
  .build();
