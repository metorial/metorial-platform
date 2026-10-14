import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { sandboxImageBuildService } from '@metorial/module-sandbox';
import { sandboxImageBuildPresenter, sandboxLogLinesPresenter } from '@metorial/presenters';
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

export let sandboxImageBuildController = Controller.create(
  {
    name: 'Sandbox image builds',
    description:
      'Builds turn a Dockerfile and its context into an image version and replicate it to every region.'
  },
  {
    list: sandboxInstanceGroup
      .get(instancePath('sandbox/image-builds', 'sandbox.imageBuilds.list'), {
        name: 'List image builds',
        description: 'Returns a paginated list of image builds across all images.'
      })
      .use(checkAccess({ possibleScopes: [...sandboxReadScopes] }))
      .outputList(sandboxImageBuildPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            image_id: v.optional(v.union([v.string(), v.array(v.string())]), {
              description: 'Filter by image'
            }),
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
          imageIds: normalizeArrayParam(ctx.query.image_id),
          imageVersionIds: normalizeArrayParam(ctx.query.image_version_id),
          statuses: normalizeArrayParam(ctx.query.status)
        });
        let list = await paginator.run(ctx.query);

        return Paginator.present(list, build => sandboxImageBuildPresenter.present({ build }));
      }),

    get: sandboxInstanceGroup
      .get(instancePath('sandbox/image-builds/:buildId', 'sandbox.imageBuilds.get'), {
        name: 'Get image build',
        description: 'Retrieves an image build by ID.'
      })
      .use(checkAccess({ possibleScopes: [...sandboxReadScopes] }))
      .output(sandboxImageBuildPresenter)
      .do(async ctx => {
        let build = await sandboxImageBuildService.get({
          instance: ctx.instance,
          buildId: requirePathParam(ctx.params, 'buildId')
        });

        return sandboxImageBuildPresenter.present({ build });
      }),

    cancel: sandboxInstanceGroup
      .post(
        instancePath('sandbox/image-builds/:buildId/cancel', 'sandbox.imageBuilds.cancel'),
        {
          name: 'Cancel image build',
          description: 'Cancels a build that is still running.'
        }
      )
      .use(checkAccess({ possibleScopes: [...sandboxWriteScopes] }))
      .output(sandboxImageBuildPresenter)
      .do(async ctx => {
        let build = await sandboxImageBuildService.cancel({
          instance: ctx.instance,
          build: { id: requirePathParam(ctx.params, 'buildId') }
        });

        return sandboxImageBuildPresenter.present({ build });
      }),

    logs: sandboxInstanceGroup
      .get(instancePath('sandbox/image-builds/:buildId/logs', 'sandbox.imageBuilds.logs'), {
        name: 'Get image build logs',
        description: 'Returns a page of the build output.'
      })
      .use(checkAccess({ possibleScopes: [...sandboxReadScopes] }))
      .query(
        'default',
        v.object({
          direction: v.optional(v.enumOf(['forward', 'backward']), {
            description: 'Whether to read from the cursor toward newer or older lines'
          }),
          cursor: v.optional(v.number(), { description: 'The line index to start from' }),
          limit: v.optional(v.number({ modifiers: [v.minValue(1), v.maxValue(1000)] }), {
            description: 'The maximum number of lines to return'
          })
        })
      )
      .output(sandboxLogLinesPresenter)
      .do(async ctx => {
        let logs = await sandboxImageBuildService.logs({
          instance: ctx.instance,
          buildId: requirePathParam(ctx.params, 'buildId'),
          input: ctx.query
        });

        return sandboxLogLinesPresenter.present({ logs });
      })
  }
);
