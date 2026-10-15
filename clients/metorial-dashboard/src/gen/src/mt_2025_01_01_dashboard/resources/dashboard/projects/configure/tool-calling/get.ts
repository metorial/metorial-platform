import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardProjectsConfigureToolCallingGetOutput = {
  object: 'organization.project.tool_calling_configuration';
  projectId: string;
  collectOperationDescriptionForToolCalls: boolean;
  messageProcessingTimeoutMs: number;
  updatedAt: Date;
};

export let mapDashboardProjectsConfigureToolCallingGetOutput =
  /* @__PURE__ */ mapObject<DashboardProjectsConfigureToolCallingGetOutput>(
    [
      'project_id',
      'collect_operation_description_for_tool_calls',
      'message_processing_timeout_ms',
      'updated_at'
    ],
    1
  );
