import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { sandboxRegionType } from '../../types';

export let v1SandboxRegionPresenter = Presenter.create(sandboxRegionType)
  .presenter(async ({ region }) => ({
    object: 'sandbox.region' as const,

    id: region.identifier,
    name: region.name,
    area: { id: region.areaId, name: region.areaName },

    availability: 'available'
  }))
  .schema(
    v.object({
      object: v.literal('sandbox.region', {
        description: "String representing the object's type"
      }),

      id: v.string({
        description: "The region's identifier, used wherever a region is requested",
        examples: ['us-east-1']
      }),
      name: v.string({ description: "The region's display name", examples: ['US East'] }),
      area: v.object({
        id: v.string({ description: "The geographic area's identifier", examples: ['us'] }),
        name: v.string({
          description: "The geographic area's name",
          examples: ['United States']
        })
      }),
      availability: v.enumOf(['available', 'unavailable'], {
        description: 'Whether the region is currently available for new machines'
      })
    })
  )
  .build();
