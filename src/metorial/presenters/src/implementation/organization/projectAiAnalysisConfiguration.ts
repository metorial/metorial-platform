import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { projectAiAnalysisConfigurationType } from '../../types';

export let v1ProjectAiAnalysisConfigurationPresenter = Presenter.create(
  projectAiAnalysisConfigurationType
)
  .presenter(async ({ project, aiAnalysisEnabled, skillReviewHoldPending }) => ({
    object: 'organization.project.ai_analysis_configuration' as const,

    project_id: project.id,
    ai_analysis_enabled: aiAnalysisEnabled,
    skill_review_hold_pending: skillReviewHoldPending,
    updated_at: project.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('organization.project.ai_analysis_configuration'),
      project_id: v.string({
        description: 'The ID of the project this configuration belongs to',
        examples: ['prj_0mm97hpoosQAcleJQRtajt']
      }),
      ai_analysis_enabled: v.boolean({
        description:
          "Whether Metorial may analyze this project's custom providers with AI to produce security reviews",
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
