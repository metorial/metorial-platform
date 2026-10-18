import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { sandboxDiskService } from '@metorial/module-sandbox';
import { sandboxDiskMountPresenter, sandboxDiskPresenter } from '@metorial/presenters';
import { Controller } from '@metorial/rest';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { instancePath } from '../../../middleware/instanceGroup';
import {
  requirePathParam,
  sandboxInstanceGroup,
  sandboxReadScopes,
  sandboxWriteScopes
} from './_middleware';

export let sandboxDiskGroup = sandboxInstanceGroup.use(async ctx => {
  let disk = await sandboxDiskService.get({
    instance: ctx.instance,
    diskId: requirePathParam(ctx.params, 'diskId')
  });

  return { disk };
});

let diskTypeValidator = v.enumOf(['standard', 'root_fs']);

export let sandboxDiskController = Controller.create(
  {
    name: 'Sandbox disks',
    description:
      'Persistent disks that can be mounted into machines. Every machine also has a root filesystem disk that is managed for it.'
  },
  {
    list: sandboxInstanceGroup
      .get(instancePath('sandbox/disks', 'sandbox.disks.list'), {
        name: 'List sandbox disks',
        description: 'Returns a paginated list of disks.'
      })
      .use(checkAccess({ possibleScopes: [...sandboxReadScopes] }))
      .outputList(sandboxDiskPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by resource IDs'
            }),
            type: v.optional(v.union([diskTypeValidator, v.array(diskTypeValidator)]), {
              description: 'Filter by disk type'
            }),
            machine_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by the machines the disks are mounted into'
            }),
            region: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by the identifiers of the regions the disks live in'
            }),
            attached: v.optional(
              v.boolean({
                description:
                  'Only disks used by an active machine (true), as its root filesystem or a mount, or only disks no machine uses (false)'
              })
            ),
            search: v.optional(v.string({ description: 'Search disks by name or ID' }))
          })
        )
      )
      .do(async ctx => {
        let paginator = sandboxDiskService.list({
          instance: ctx.instance,
          diskIds:
            ctx.query.id === undefined ? undefined : (normalizeArrayParam(ctx.query.id) ?? []),
          types: normalizeArrayParam(ctx.query.type),
          machineIds: normalizeArrayParam(ctx.query.machine_id),
          regionIdentifiers: normalizeArrayParam(ctx.query.region),
          attached: ctx.query.attached,
          search: ctx.query.search
        });
        let list = await paginator.run(ctx.query);

        return Paginator.present(list, disk => sandboxDiskPresenter.present({ disk }));
      }),

    get: sandboxDiskGroup
      .get(instancePath('sandbox/disks/:diskId', 'sandbox.disks.get'), {
        name: 'Get sandbox disk',
        description: 'Retrieves a disk by ID.'
      })
      .use(checkAccess({ possibleScopes: [...sandboxReadScopes] }))
      .output(sandboxDiskPresenter)
      .do(async ctx => sandboxDiskPresenter.present({ disk: ctx.disk })),

    create: sandboxInstanceGroup
      .post(instancePath('sandbox/disks', 'sandbox.disks.create'), {
        name: 'Create sandbox disk',
        description: 'Creates an empty disk.'
      })
      .use(checkAccess({ possibleScopes: [...sandboxWriteScopes] }))
      .body(
        'default',
        v.object({
          region: v.string({
            description: 'The identifier of the region to create the disk in'
          }),
          metadata: v.optional(
            v.record(v.any(), {
              description:
                'User-defined metadata stored in Metorial. Replaces existing metadata when updated.'
            })
          ),
          name: v.optional(v.string({ description: 'A name for the disk' })),
          size_bytes: v.optional(
            v.number({ description: 'The capacity of the disk in bytes' })
          )
        })
      )
      .output(sandboxDiskPresenter)
      .do(async ctx => {
        let disk = await sandboxDiskService.create({
          auditScope: ctx.auditScope,
          instance: ctx.instance,
          regionIdentifier: ctx.body.region,
          input: {
            metadata: ctx.body.metadata,
            name: ctx.body.name,
            sizeBytes: ctx.body.size_bytes
          }
        });

        return sandboxDiskPresenter.present({ disk });
      }),

    update: sandboxDiskGroup
      .patch(instancePath('sandbox/disks/:diskId', 'sandbox.disks.update'), {
        name: 'Update sandbox disk',
        description:
          'Updates a disk name and metadata. Only metadata can be updated for root filesystem disks.'
      })
      .use(checkAccess({ possibleScopes: [...sandboxWriteScopes] }))
      .body(
        'default',
        v.object({
          metadata: v.optional(
            v.record(v.any(), {
              description:
                'User-defined metadata stored in Metorial. Replaces existing metadata when updated.'
            })
          ),
          name: v.optional(
            v.nullable(
              v.string({
                description: 'A name for the disk. Pass null to remove it.',
                modifiers: [v.minLength(1), v.maxLength(128)]
              })
            )
          )
        })
      )
      .output(sandboxDiskPresenter)
      .do(async ctx => {
        let disk = await sandboxDiskService.update({
          auditScope: ctx.auditScope,
          disk: ctx.disk,
          input: { metadata: ctx.body.metadata, name: ctx.body.name }
        });

        return sandboxDiskPresenter.present({ disk });
      }),

    delete: sandboxDiskGroup
      .delete(instancePath('sandbox/disks/:diskId', 'sandbox.disks.delete'), {
        name: 'Delete sandbox disk',
        description:
          'Deletes a disk. Root filesystem disks cannot be deleted; they are removed with their machine.'
      })
      .use(checkAccess({ possibleScopes: [...sandboxWriteScopes] }))
      .output(sandboxDiskPresenter)
      .do(async ctx => {
        let disk = await sandboxDiskService.delete({
          auditScope: ctx.auditScope,
          disk: ctx.disk
        });

        return sandboxDiskPresenter.present({ disk });
      }),

    clone: sandboxDiskGroup
      .post(instancePath('sandbox/disks/:diskId/clone', 'sandbox.disks.clone'), {
        name: 'Clone sandbox disk',
        description: 'Creates a copy of a disk in the same region.'
      })
      .use(checkAccess({ possibleScopes: [...sandboxWriteScopes] }))
      .body(
        'default',
        v.object({
          metadata: v.optional(
            v.record(v.any(), {
              description:
                'User-defined metadata stored in Metorial. Replaces existing metadata when updated.'
            })
          ),
          name: v.optional(v.string({ description: 'A name for the new disk' }))
        })
      )
      .output(sandboxDiskPresenter)
      .do(async ctx => {
        let disk = await sandboxDiskService.clone({
          auditScope: ctx.auditScope,
          instance: ctx.instance,
          disk: ctx.disk,
          input: { metadata: ctx.body.metadata, name: ctx.body.name }
        });

        return sandboxDiskPresenter.present({ disk });
      }),

    mounts: sandboxDiskGroup
      .get(instancePath('sandbox/disks/:diskId/mounts', 'sandbox.disks.mounts.list'), {
        name: 'List disk mounts',
        description: 'Returns a paginated list of the times a disk was mounted into a machine.'
      })
      .use(checkAccess({ possibleScopes: [...sandboxReadScopes] }))
      .outputList(sandboxDiskMountPresenter)
      .query('default', Paginator.validate())
      .do(async ctx => {
        let paginator = sandboxDiskService.mounts({ disk: ctx.disk });
        let list = await paginator.run(ctx.query);

        return Paginator.present(list, mount => sandboxDiskMountPresenter.present({ mount }));
      })
  }
);
