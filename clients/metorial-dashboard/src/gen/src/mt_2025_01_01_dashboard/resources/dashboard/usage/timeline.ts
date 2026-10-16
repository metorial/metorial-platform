import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardUsageTimelineOutput = {
  object: 'machine_access.api_key';
  timeline: {
    entityId: string;
    entityType: string;
    ownerId: string;
    entries: { ts: Date; count: number }[];
  }[];
};

export let mapDashboardUsageTimelineOutput =
  /* @__PURE__ */ mapObject<DashboardUsageTimelineOutput>([
    [
      'timeline',
      0,
      [
        2,
        [
          1,
          [
            'entity_id',
            'entity_type',
            'owner_id',
            ['entries', 0, [2, [1, [['ts', 0, 4]]]]]
          ]
        ]
      ]
    ]
  ]);

export type DashboardUsageTimelineQuery = {
  entities: { type: string; id?: string | undefined }[];
  from: Date;
  to: Date;
  interval: { unit: 'day' | 'hour'; count: number };
};

export let mapDashboardUsageTimelineQuery =
  /* @__PURE__ */ mapObject<DashboardUsageTimelineQuery>([
    ['from', 0, 4],
    ['to', 0, 4]
  ]);
