import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { sandboxDiskResizeService } from '@metorial/module-sandbox';
import { sandboxDiskResizePresenter } from '@metorial/presenters';
import { Controller } from '@metorial/rest';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { instancePath } from '../../../middleware/instanceGroup';
import { requirePathParam, sandboxReadScopes, sandboxWriteScopes } from './_middleware';
import { sandboxDiskGroup } from './disk';

let resizeStatusValidator = v.enumOf([
  'pending',
  'draining',
  'resizing',
  'verifying',
  'restarting',
  'complete',
  'failed'
]);

export let sandboxDiskResizeController = Controller.create(
  {
    name: 'Sandbox disk resizes',
    description:
      'Resizing a disk briefly stops the machines it is mounted into. Each resize is tracked until it completes.'
  },
  {
    start: sandboxDiskGroup
      .post(instancePath('sandbox/disks/:diskId/resize', 'sandbox.disks.resize'), {
        name: 'Resize sandbox disk',
        description: 'Starts growing a disk to a larger size.'
      })
      .use(checkAccess({ possibleScopes: [...sandboxWriteScopes] }))
      .body(
        'default',
        v.object({
          size_bytes: v.number({ description: 'The new capacity of the disk in bytes' })
        })
      )
      .output(sandboxDiskResizePresenter)
      .do(async ctx => {
        let resize = await sandboxDiskResizeService.start({
          auditScope: ctx.auditScope,
          disk: ctx.disk,
          input: {
            sizeBytes: String(ctx.body.size_bytes),
            idempotencyKey: crypto.randomUUID()
          }
        });

        return sandboxDiskResizePresenter.present({ resize });
      }),

    list: sandboxDiskGroup
      .get(instancePath('sandbox/disks/:diskId/resizes', 'sandbox.disks.resizes.list'), {
        name: 'List disk resizes',
        description: 'Returns a paginated list of the resizes of a disk.'
      })
      .use(checkAccess({ possibleScopes: [...sandboxReadScopes] }))
      .outputList(sandboxDiskResizePresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            status: v.optional(
              v.union([resizeStatusValidator, v.array(resizeStatusValidator)]),
              {
                description: 'Filter by resize status'
              }
            )
          })
        )
      )
      .do(async ctx => {
        let paginator = sandboxDiskResizeService.list({
          disk: ctx.disk,
          statuses: normalizeArrayParam(ctx.query.status)
        });
        let list = await paginator.run(ctx.query);

        return Paginator.present(list, resize =>
          sandboxDiskResizePresenter.present({ resize })
        );
      }),

    get: sandboxDiskGroup
      .get(
        instancePath('sandbox/disks/:diskId/resizes/:resizeId', 'sandbox.disks.resizes.get'),
        {
          name: 'Get disk resize',
          description: 'Retrieves a resize of a disk.'
        }
      )
      .use(checkAccess({ possibleScopes: [...sandboxReadScopes] }))
      .output(sandboxDiskResizePresenter)
      .do(async ctx => {
        let resize = await sandboxDiskResizeService.get({
          disk: ctx.disk,
          resizeId: requirePathParam(ctx.params, 'resizeId')
        });

        return sandboxDiskResizePresenter.present({ resize });
      }),

    retry: sandboxDiskGroup
      .post(
        instancePath(
          'sandbox/disks/:diskId/resizes/:resizeId/retry',
          'sandbox.disks.resizes.retry'
        ),
        {
          name: 'Retry disk resize',
          description: 'Retries a resize that failed.'
        }
      )
      .use(checkAccess({ possibleScopes: [...sandboxWriteScopes] }))
      .output(sandboxDiskResizePresenter)
      .do(async ctx => {
        let resize = await sandboxDiskResizeService.retry({
          auditScope: ctx.auditScope,
          disk: ctx.disk,
          resizeId: requirePathParam(ctx.params, 'resizeId')
        });

        return sandboxDiskResizePresenter.present({ resize });
      })
  }
);
