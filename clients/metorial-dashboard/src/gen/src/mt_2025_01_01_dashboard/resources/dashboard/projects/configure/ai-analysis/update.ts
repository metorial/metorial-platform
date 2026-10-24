import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardProjectsConfigureAiAnalysisUpdateOutput = {
  object: 'organization.project.ai_analysis_configuration';
  projectId: string;
  aiAnalysisEnabled: boolean;
  updatedAt: Date;
};

export let mapDashboardProjectsConfigureAiAnalysisUpdateOutput =
  /* @__PURE__ */ mapObject<DashboardProjectsConfigureAiAnalysisUpdateOutput>(
    ['project_id', 'ai_analysis_enabled', 'updated_at'],
    1
  );

export type DashboardProjectsConfigureAiAnalysisUpdateBody = {
  aiAnalysisEnabled: boolean;
};

export let mapDashboardProjectsConfigureAiAnalysisUpdateBody =
  /* @__PURE__ */ mapObject<DashboardProjectsConfigureAiAnalysisUpdateBody>([
    'ai_analysis_enabled'
  ]);
