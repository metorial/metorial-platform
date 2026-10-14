import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { fileService } from '@metorial/module-file';
import {
  sandboxImageBuildService,
  sandboxImageService,
  sandboxImageVersionService
} from '@metorial/module-sandbox';
import {
  sandboxImageBuildPresenter,
  sandboxImagePresenter,
  sandboxImageVersionPresenter
} from '@metorial/presenters';
import { Controller } from '@metorial/rest';
import { getInstanceCargoAccess } from '../../../lib/cargoAccess';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { instancePath } from '../../../middleware/instanceGroup';
import {
  requirePathParam,
  sandboxInstanceGroup,
  sandboxReadScopes,
  sandboxWriteScopes
} from './_middleware';

export let sandboxImageGroup = sandboxInstanceGroup.use(async ctx => {
  let image = await sandboxImageService.get({
    instance: ctx.instance,
    imageId: requirePathParam(ctx.params, 'imageId')
  });

  return { image };
});

let ownerValidator = v.enumOf(['own', 'global']);
let imageStatusValidator = v.enumOf(['pending', 'active', 'deleted']);
let buildStatusValidator = v.enumOf([
  'preparing',
  'queued',
  'building',
  'processing',
  'replicating',
  'succeeded',
  'failed',
  'cancelled',
  'timed_out'
]);

export let sandboxImageController = Controller.create(
  {
    name: 'Sandbox images',
    description:
      'Images machines boot from. Metorial provides global images, and you can build your own from a Dockerfile.'
  },
  {
    list: sandboxInstanceGroup
      .get(instancePath('sandbox/images', 'sandbox.images.list'), {
        name: 'List sandbox images',
        description: 'Returns a paginated list of the images you can create machines from.'
      })
      .use(checkAccess({ possibleScopes: [...sandboxReadScopes] }))
      .outputList(sandboxImagePresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            owner: v.optional(v.union([ownerValidator, v.array(ownerValidator)]), {
              description:
                'Whether to list your own images, global images, or both (the default)'
            }),
            status: v.optional(
              v.union([imageStatusValidator, v.array(imageStatusValidator)]),
              {
                description: 'Filter by image status'
              }
            ),
            search: v.optional(v.string(), { description: 'Search by name or identifier' })
          })
        )
      )
      .do(async ctx => {
        let paginator = await sandboxImageService.list({
          instance: ctx.instance,
          owners: normalizeArrayParam(ctx.query.owner),
          statuses: normalizeArrayParam(ctx.query.status),
          search: ctx.query.search
        });
        let list = await paginator.run(ctx.query);

        return Paginator.present(list, image => sandboxImagePresenter.present({ image }));
      }),

    get: sandboxImageGroup
      .get(instancePath('sandbox/images/:imageId', 'sandbox.images.get'), {
        name: 'Get sandbox image',
        description: 'Retrieves an image by ID.'
      })
      .use(checkAccess({ possibleScopes: [...sandboxReadScopes] }))
      .output(sandboxImagePresenter)
      .do(async ctx => sandboxImagePresenter.present({ image: ctx.image })),

    create: sandboxInstanceGroup
      .post(instancePath('sandbox/images', 'sandbox.images.create'), {
        name: 'Create sandbox image',
        description:
          'Creates an empty image. Build a version of it to make it available to machines.'
      })
      .use(checkAccess({ possibleScopes: [...sandboxWriteScopes] }))
      .body(
        'default',
        v.object({ name: v.optional(v.string({ description: 'A name for the image' })) })
      )
      .output(sandboxImagePresenter)
      .do(async ctx => {
        let image = await sandboxImageService.create({
          instance: ctx.instance,
          input: { name: ctx.body.name }
        });

        return sandboxImagePresenter.present({ image });
      }),

    update: sandboxImageGroup
      .patch(instancePath('sandbox/images/:imageId', 'sandbox.images.update'), {
        name: 'Update sandbox image',
        description: 'Renames one of your images.'
      })
      .use(checkAccess({ possibleScopes: [...sandboxWriteScopes] }))
      .body(
        'default',
        v.object({
          name: v.optional(v.nullable(v.string({ description: 'A name for the image' })))
        })
      )
      .output(sandboxImagePresenter)
      .do(async ctx => {
        let image = await sandboxImageService.update({
          instance: ctx.instance,
          image: ctx.image,
          input: { name: ctx.body.name }
        });

        return sandboxImagePresenter.present({ image });
      }),

    delete: sandboxImageGroup
      .delete(instancePath('sandbox/images/:imageId', 'sandbox.images.delete'), {
        name: 'Delete sandbox image',
        description: 'Deletes one of your images and cancels its running builds.'
      })
      .use(checkAccess({ possibleScopes: [...sandboxWriteScopes] }))
      .output(sandboxImagePresenter)
      .do(async ctx => {
        let image = await sandboxImageService.delete({
          instance: ctx.instance,
          image: ctx.image
        });

        return sandboxImagePresenter.present({ image });
      }),

    listVersions: sandboxImageGroup
      .get(instancePath('sandbox/images/:imageId/versions', 'sandbox.images.versions.list'), {
        name: 'List image versions',
        description: 'Returns a paginated list of the versions of an image.'
      })
      .use(checkAccess({ possibleScopes: [...sandboxReadScopes] }))
      .outputList(sandboxImageVersionPresenter)
      .query('default', Paginator.validate())
      .do(async ctx => {
        let paginator = await sandboxImageVersionService.list({ image: ctx.image });
        let list = await paginator.run(ctx.query);

        return Paginator.present(list, version =>
          sandboxImageVersionPresenter.present({ image: ctx.image, version })
        );
      }),

    getVersion: sandboxImageGroup
      .get(
        instancePath(
          'sandbox/images/:imageId/versions/:versionId',
          'sandbox.images.versions.get'
        ),
        {
          name: 'Get image version',
          description: 'Retrieves a version of an image.'
        }
      )
      .use(checkAccess({ possibleScopes: [...sandboxReadScopes] }))
      .output(sandboxImageVersionPresenter)
      .do(async ctx => {
        let version = await sandboxImageVersionService.get({
          image: ctx.image,
          versionId: requirePathParam(ctx.params, 'versionId')
        });

        return sandboxImageVersionPresenter.present({ image: ctx.image, version });
      }),

    // createDisk: sandboxImageGroup
    //   .post(instancePath('sandbox/images/:imageId/disks', 'sandbox.images.disks.create'), {
    //     name: 'Create disk from image',
    //     description: 'Creates a disk holding the contents of an image version.'
    //   })
    //   .use(checkAccess({ possibleScopes: [...sandboxWriteScopes] }))
    //   .body(
    //     'default',
    //     v.object({
    //       region: v.string({
    //         description: 'The identifier of the region to create the disk in'
    //       }),
    //       version_id: v.optional(
    //         v.string({ description: 'The image version to use. Defaults to the latest.' })
    //       ),
    //       name: v.optional(v.string({ description: 'A name for the disk' }))
    //     })
    //   )
    //   .output(sandboxDiskPresenter)
    //   .do(async ctx => {
    //     let disk = await sandboxImageService.createDisk({
    //       instance: ctx.instance,
    //       image: ctx.image,
    //       regionIdentifier: ctx.body.region,
    //       input: {
    //         versionId: ctx.body.version_id,
    //         name: ctx.body.name
    //       }
    //     });

    //     return sandboxDiskPresenter.present({ disk });
    //   }),

    listBuilds: sandboxImageGroup
      .get(instancePath('sandbox/images/:imageId/builds', 'sandbox.images.builds.list'), {
        name: 'List image builds',
        description: 'Returns a paginated list of the builds of an image.'
      })
      .use(checkAccess({ possibleScopes: [...sandboxReadScopes] }))
      .outputList(sandboxImageBuildPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            image_version_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by image version'
            }),
            status: v.optional(
              v.union([buildStatusValidator, v.array(buildStatusValidator)]),
              {
                description: 'Filter by build status'
              }
            )
          })
        )
      )
      .do(async ctx => {
        let paginator = await sandboxImageBuildService.list({
          instance: ctx.instance,
          image: ctx.image,
          imageVersionIds: normalizeArrayParam(ctx.query.image_version_id),
          statuses: normalizeArrayParam(ctx.query.status)
        });
        let list = await paginator.run(ctx.query);

        return Paginator.present(list, build => sandboxImageBuildPresenter.present({ build }));
      }),

    createBuild: sandboxImageGroup
      .post(instancePath('sandbox/images/:imageId/builds', 'sandbox.images.builds.create'), {
        name: 'Build image',
        description:
          'Builds a new version of an image from a Dockerfile. Upload the build context as a file with the sandbox_image_build_context purpose first.'
      })
      .use(checkAccess({ possibleScopes: [...sandboxWriteScopes] }))
      .body(
        'default',
        v.object({
          file_id: v.string({
            description:
              'The file holding the build context as a zip, tar, or tar.gz archive. Limited to 50 MB.'
          }),
          dockerfile_path: v.optional(
            v.string({ description: 'The path of the Dockerfile inside the context' })
          ),
          context_path: v.optional(
            v.string({ description: 'The directory inside the archive to build from' })
          ),
          target: v.optional(v.string({ description: 'The build stage to build' })),
          build_args: v.optional(
            v.record(v.string(), { description: 'Build arguments passed to the Dockerfile' })
          ),
          timeout_seconds: v.optional(
            v.number({ description: 'How long the build may run before it is cancelled' })
          ),
          disk_size_bytes: v.optional(
            v.number({ description: 'The size of disks created from the image' })
          )
        })
      )
      .output(sandboxImageBuildPresenter)
      .do(async ctx => {
        let file = await fileService.getFileById({
          fileId: ctx.body.file_id,
          ...(await getInstanceCargoAccess(ctx))
        });

        let build = await sandboxImageBuildService.create({
          instance: ctx.instance,
          organization: ctx.organization,
          image: ctx.image,
          file,
          input: {
            dockerfilePath: ctx.body.dockerfile_path,
            contextPath: ctx.body.context_path,
            target: ctx.body.target,
            buildArgs: ctx.body.build_args,
            timeoutSeconds: ctx.body.timeout_seconds,
            diskSizeBytes: ctx.body.disk_size_bytes
          }
        });

        return sandboxImageBuildPresenter.present({ build });
      })
  }
);
