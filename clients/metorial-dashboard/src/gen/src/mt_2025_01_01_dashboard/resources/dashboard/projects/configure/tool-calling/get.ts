import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardProjectsConfigureToolCallingGetOutput = {
  object: 'organization.project.tool_calling_configuration';
  projectId: string;
  collectOperationDescriptionForToolCalls: boolean;
  messageProcessingTimeoutMs: number;
  updatedAt: Date;
};

export let mapDashboardProjectsConfigureToolCallingGetOutput =
  mtMap.object<DashboardProjectsConfigureToolCallingGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    projectId: mtMap.objectField('project_id', mtMap.passthrough()),
    collectOperationDescriptionForToolCalls: mtMap.objectField(
      'collect_operation_description_for_tool_calls',
      mtMap.passthrough()
    ),
    messageProcessingTimeoutMs: mtMap.objectField(
      'message_processing_timeout_ms',
      mtMap.passthrough()
    ),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

