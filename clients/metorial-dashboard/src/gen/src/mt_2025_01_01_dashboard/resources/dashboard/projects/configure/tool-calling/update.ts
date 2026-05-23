import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardProjectsConfigureToolCallingUpdateOutput = {
  object: 'organization.project.tool_calling_configuration';
  projectId: string;
  collectOperationDescriptionForToolCalls: boolean;
  updatedAt: Date;
};

export let mapDashboardProjectsConfigureToolCallingUpdateOutput =
  mtMap.object<DashboardProjectsConfigureToolCallingUpdateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    projectId: mtMap.objectField('project_id', mtMap.passthrough()),
    collectOperationDescriptionForToolCalls: mtMap.objectField(
      'collect_operation_description_for_tool_calls',
      mtMap.passthrough()
    ),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type DashboardProjectsConfigureToolCallingUpdateBody = {
  collectOperationDescriptionForToolCalls?: boolean | undefined;
};

export let mapDashboardProjectsConfigureToolCallingUpdateBody =
  mtMap.object<DashboardProjectsConfigureToolCallingUpdateBody>({
    collectOperationDescriptionForToolCalls: mtMap.objectField(
      'collect_operation_description_for_tool_calls',
      mtMap.passthrough()
    )
  });

