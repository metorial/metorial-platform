import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardProjectsConfigureDataRetentionUpdateOutput = {
  object: 'organization.project.data_retention_configuration';
  projectId: string;
  dataRetentionLevel: 'full' | 'intent_only' | 'none';
  storeToolCallAttachments: boolean;
  collectErrors: boolean;
  disableCallbacks: boolean;
  updatedAt: Date;
};

export let mapDashboardProjectsConfigureDataRetentionUpdateOutput =
  /* @__PURE__ */ mapObject<DashboardProjectsConfigureDataRetentionUpdateOutput>(
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

export type DashboardProjectsConfigureDataRetentionUpdateBody = {
  dataRetentionLevel?: 'full' | 'intent_only' | 'none' | undefined;
  storeToolCallAttachments?: boolean | undefined;
  collectErrors?: boolean | undefined;
  disableCallbacks?: boolean | undefined;
};

export let mapDashboardProjectsConfigureDataRetentionUpdateBody =
  /* @__PURE__ */ mapObject<DashboardProjectsConfigureDataRetentionUpdateBody>([
    'data_retention_level',
    'store_tool_call_attachments',
    'collect_errors',
    'disable_callbacks'
  ]);
