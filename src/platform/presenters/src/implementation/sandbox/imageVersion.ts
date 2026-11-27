import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { sandboxImageVersionType } from '../../types';

export let v1SandboxImageVersionPresenter = Presenter.create(sandboxImageVersionType)
  .presenter(async ({ image, version }) => ({
    object: 'sandbox.image.version' as const,

    id: version.id,
    image_id: image.id,
    version_number: version.versionNumber,
    build_id: version.builds.at(0)?.id ?? null,
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
      version_number: v.nullable(
        v.number({
          description:
            'The position of the version within its image, starting at 1. Null only briefly for versions that are still being numbered.'
        })
      ),
      build_id: v.nullable(
        v.string({
          description:
            'The build that produced the version. Null for versions of global images.'
        })
      ),
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
