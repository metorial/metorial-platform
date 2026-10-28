import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardProjectsConfigureAiAnalysisUpdateOutput = {
  object: 'organization.project.ai_analysis_configuration';
  projectId: string;
  aiAnalysisEnabled: boolean;
  usageReviewsEnabled: boolean;
  skillReviewHoldPending: boolean;
  updatedAt: Date;
};

export let mapDashboardProjectsConfigureAiAnalysisUpdateOutput =
  /* @__PURE__ */ mapObject<DashboardProjectsConfigureAiAnalysisUpdateOutput>(
    [
      'project_id',
      'ai_analysis_enabled',
      'usage_reviews_enabled',
      'skill_review_hold_pending',
      'updated_at'
    ],
    1
  );

export type DashboardProjectsConfigureAiAnalysisUpdateBody = {
  aiAnalysisEnabled?: boolean | undefined;
  usageReviewsEnabled?: boolean | undefined;
  skillReviewHoldPending?: boolean | undefined;
};

export let mapDashboardProjectsConfigureAiAnalysisUpdateBody =
  /* @__PURE__ */ mapObject<DashboardProjectsConfigureAiAnalysisUpdateBody>([
    'ai_analysis_enabled',
    'usage_reviews_enabled',
    'skill_review_hold_pending'
  ]);
