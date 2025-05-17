import { Presenter } from '@metorial/presenter';
import { v } from '@metorial/validation';
import { usageType } from '../types';

export let v1UsagePresenter = Presenter.create(usageType)
  .presenter(async ({ timeline }, opts) => ({
    object: 'usage',

    timeline: timeline.map(tl => ({
      entity_id: tl.entityId,
      entity_type: tl.entityType,
      owner_id: tl.ownerId,
      entries: tl.entries
    }))
  }))
  .schema(
    v.object({
      object: v.literal('machine_access.api_key'),

      timeline: v.array(
        v.object({
          entity_id: v.string(),
          entity_type: v.string(),
          owner_id: v.string(),
          entries: v.array(
            v.object({
              ts: v.date(),
              count: v.number()
            })
          )
        })
      )
    })
  )
  .build();
