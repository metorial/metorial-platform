import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardProjectsConfigureAgentTrackingUpdateOutput = {
  object: 'agent_tracking.project_settings';
  organizationId: string;
  projectId: string;
  serviceStatus: 'applied' | 'pending' | 'unknown';
  retention: {
    recordDays: number | null;
    contentDays: number | null;
    usageDays: number | null;
    defaultRecordDays: number;
    defaultContentDays: number;
    defaultUsageDays: number;
  };
};

export let mapDashboardProjectsConfigureAgentTrackingUpdateOutput =
  /* @__PURE__ */ mapObject<DashboardProjectsConfigureAgentTrackingUpdateOutput>(
    [
      'organization_id',
      'project_id',
      'service_status',
      [
        'retention',
        0,
        [
          1,
          [
            'record_days',
            'content_days',
            'usage_days',
            'default_record_days',
            'default_content_days',
            'default_usage_days'
          ]
        ]
      ]
    ]
  );

export type DashboardProjectsConfigureAgentTrackingUpdateBody = {
  retention: {
    recordDays?: number | null | undefined;
    contentDays?: number | null | undefined;
    usageDays?: number | null | undefined;
  };
};

export let mapDashboardProjectsConfigureAgentTrackingUpdateBody =
  /* @__PURE__ */ mapObject<DashboardProjectsConfigureAgentTrackingUpdateBody>([
    ['retention', 0, [1, ['record_days', 'content_days', 'usage_days']]]
  ]);
