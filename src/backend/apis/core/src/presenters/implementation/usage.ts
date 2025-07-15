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
      object: v.literal('machine_access.api_key', {
        name: 'object',
        description: 'Type of the object, fixed as machine_access.api_key'
      }),

      timeline: v.array(
        v.object({
          entity_id: v.string({
            name: 'entity_id',
            description: 'Unique identifier of the entity'
          }),
          entity_type: v.string({
            name: 'entity_type',
            description: 'Type of the entity'
          }),
          owner_id: v.string({
            name: 'owner_id',
            description: 'Identifier of the owner of the entity'
          }),
          entries: v.array(
            v.object({
              ts: v.date({
                name: 'ts',
                description: 'Timestamp of the entry'
              }),
              count: v.number({
                name: 'count',
                description: 'Count associated with this timestamp'
              })
            }),
            {
              name: 'entries',
              description: 'List of usage or activity entries over time'
            }
          )
        }),
        {
          name: 'timeline',
          description: 'Timeline of entity activity grouped by entity'
        }
      )
    })
  )
  .build();
