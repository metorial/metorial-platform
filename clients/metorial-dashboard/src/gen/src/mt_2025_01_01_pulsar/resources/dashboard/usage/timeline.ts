import { mtMap } from '@metorial/util-resource-mapper';

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
  mtMap.object<DashboardUsageTimelineOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    timeline: mtMap.objectField(
      'timeline',
      mtMap.array(
        mtMap.object({
          entityId: mtMap.objectField('entity_id', mtMap.passthrough()),
          entityType: mtMap.objectField('entity_type', mtMap.passthrough()),
          ownerId: mtMap.objectField('owner_id', mtMap.passthrough()),
          entries: mtMap.objectField(
            'entries',
            mtMap.array(
              mtMap.object({
                ts: mtMap.objectField('ts', mtMap.date()),
                count: mtMap.objectField('count', mtMap.passthrough())
              })
            )
          )
        })
      )
    )
  });

export type DashboardUsageTimelineQuery = {
  entities: { type: string; id: string }[];
  from: Date;
  to: Date;
  interval: { unit: 'day' | 'hour'; count: number };
};

export let mapDashboardUsageTimelineQuery =
  mtMap.object<DashboardUsageTimelineQuery>({
    entities: mtMap.objectField(
      'entities',
      mtMap.array(
        mtMap.object({
          type: mtMap.objectField('type', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough())
        })
      )
    ),
    from: mtMap.objectField('from', mtMap.date()),
    to: mtMap.objectField('to', mtMap.date()),
    interval: mtMap.objectField(
      'interval',
      mtMap.object({
        unit: mtMap.objectField('unit', mtMap.union([])),
        count: mtMap.objectField('count', mtMap.passthrough())
      })
    )
  });

