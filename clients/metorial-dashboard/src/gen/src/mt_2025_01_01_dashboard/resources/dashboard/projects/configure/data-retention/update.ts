import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardProjectsConfigureDataRetentionUpdateOutput = {
  object: 'organization.project.data_retention_configuration';
  projectId: string;
  dataRetentionLevel: 'full' | 'intent_only' | 'none';
  storeToolCallAttachments: boolean;
  collectErrors: boolean;
  updatedAt: Date;
};

export let mapDashboardProjectsConfigureDataRetentionUpdateOutput =
  mtMap.object<DashboardProjectsConfigureDataRetentionUpdateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    projectId: mtMap.objectField('project_id', mtMap.passthrough()),
    dataRetentionLevel: mtMap.objectField(
      'data_retention_level',
      mtMap.passthrough()
    ),
    storeToolCallAttachments: mtMap.objectField(
      'store_tool_call_attachments',
      mtMap.passthrough()
    ),
    collectErrors: mtMap.objectField('collect_errors', mtMap.passthrough()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });
export type DashboardProjectsConfigureDataRetentionUpdateBody = {
  dataRetentionLevel?: 'full' | 'intent_only' | 'none' | undefined;
  storeToolCallAttachments?: boolean | undefined;
  collectErrors?: boolean | undefined;
};

export let mapDashboardProjectsConfigureDataRetentionUpdateBody =
  mtMap.object<DashboardProjectsConfigureDataRetentionUpdateBody>({
    dataRetentionLevel: mtMap.objectField(
      'data_retention_level',
      mtMap.passthrough()
    ),
    storeToolCallAttachments: mtMap.objectField(
      'store_tool_call_attachments',
      mtMap.passthrough()
    ),
    collectErrors: mtMap.objectField('collect_errors', mtMap.passthrough())
  });
