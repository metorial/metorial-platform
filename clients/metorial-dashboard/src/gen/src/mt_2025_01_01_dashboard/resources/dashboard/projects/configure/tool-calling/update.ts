import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardProjectsConfigureToolCallingUpdateOutput = {
  object: 'organization.project.tool_calling_configuration';
  projectId: string;
  collectOperationDescriptionForToolCalls: boolean;
  messageProcessingTimeoutMs: number;
  updatedAt: Date;
};

export let mapDashboardProjectsConfigureToolCallingUpdateOutput =
  /* @__PURE__ */ mapObject<DashboardProjectsConfigureToolCallingUpdateOutput>(
    [
      'project_id',
      'collect_operation_description_for_tool_calls',
      'message_processing_timeout_ms',
      'updated_at'
    ],
    1
  );

export type DashboardProjectsConfigureToolCallingUpdateBody = {
  collectOperationDescriptionForToolCalls?: boolean | undefined;
  messageProcessingTimeoutMs?: number | undefined;
};

export let mapDashboardProjectsConfigureToolCallingUpdateBody =
  /* @__PURE__ */ mapObject<DashboardProjectsConfigureToolCallingUpdateBody>([
    'collect_operation_description_for_tool_calls',
    'message_processing_timeout_ms'
  ]);
