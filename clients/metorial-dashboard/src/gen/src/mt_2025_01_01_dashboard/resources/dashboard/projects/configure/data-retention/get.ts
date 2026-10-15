import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardProjectsConfigureDataRetentionGetOutput = {
  object: 'organization.project.data_retention_configuration';
  projectId: string;
  dataRetentionLevel: 'full' | 'intent_only' | 'none';
  storeToolCallAttachments: boolean;
  collectErrors: boolean;
  disableCallbacks: boolean;
  updatedAt: Date;
};

export let mapDashboardProjectsConfigureDataRetentionGetOutput =
  /* @__PURE__ */ mapObject<DashboardProjectsConfigureDataRetentionGetOutput>(
    [
      'project_id',
      'data_retention_level',
      'store_tool_call_attachments',
      'collect_errors',
      'disable_callbacks',
      'updated_at'
    ],
    1
  );
