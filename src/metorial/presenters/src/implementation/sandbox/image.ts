import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { sandboxImageType } from '../../types';

export let v1SandboxImagePresenter = Presenter.create(sandboxImageType)
  .presenter(async ({ image }) => {
    let latestVersion = [...image.versions]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .at(0);

    return {
      object: 'sandbox.image' as const,

      id: image.id,
      owner: image.instanceOid === null ? ('global' as const) : ('own' as const),
      status: image.status,
      name: image.name,
      identifier: image.identifier,

      regions: image.regions.map(regional => regional.region.identifier),
      latest_version_id: latestVersion?.id ?? null,

      created_at: image.createdAt,
      updated_at: image.updatedAt,
      deleted_at: image.deletedAt
    };
  })
  .schema(
    v.object({
      object: v.literal('sandbox.image', {
        description: "String representing the object's type"
      }),

      id: v.string({ description: "The image's unique identifier" }),
      owner: v.enumOf(['own', 'global'], {
        description: 'Whether you built the image or Metorial provides it to everyone'
      }),
      status: v.enumOf(['pending', 'active', 'deleted'], {
        description: "The image's status. Images are pending until their first build succeeds."
      }),
      name: v.nullable(v.string({ description: "The image's name" })),
      identifier: v.nullable(
        v.string({
          description: "The image's human-readable identifier, set for global images"
        })
      ),

      regions: v.array(v.string(), {
        description: 'The identifiers of the regions the image is available in'
      }),
      latest_version_id: v.nullable(
        v.string({ description: 'The most recent version of the image' })
      ),

      created_at: v.date(),
      updated_at: v.date(),
      deleted_at: v.nullable(v.date())
    })
  )
  .build();
