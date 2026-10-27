import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardProjectsConfigureAiAnalysisGetOutput = {
  object: 'organization.project.ai_analysis_configuration';
  projectId: string;
  aiAnalysisEnabled: boolean;
  skillReviewHoldPending: boolean;
  updatedAt: Date;
};

export let mapDashboardProjectsConfigureAiAnalysisGetOutput =
  /* @__PURE__ */ mapObject<DashboardProjectsConfigureAiAnalysisGetOutput>(
    [
      'project_id',
      'ai_analysis_enabled',
      'skill_review_hold_pending',
      'updated_at'
    ],
    1
  );
