import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { sandboxImageVersionType } from '../../types';

export let v1SandboxImageVersionPresenter = Presenter.create(sandboxImageVersionType)
  .presenter(async ({ image, version }) => ({
    object: 'sandbox.image.version' as const,

    id: version.id,
    image_id: image.id,
    status: version.status,
    regions: version.regions.map(regional => regional.region.identifier),

    created_at: version.createdAt,
    updated_at: version.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('sandbox.image.version', {
        description: "String representing the object's type"
      }),

      id: v.string({ description: "The version's unique identifier" }),
      image_id: v.string({ description: 'The image the version belongs to' }),
      status: v.enumOf(['pending', 'active', 'deleted'], {
        description: "The version's status"
      }),
      regions: v.array(v.string(), {
        description: 'The identifiers of the regions the version is available in'
      }),

      created_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();
