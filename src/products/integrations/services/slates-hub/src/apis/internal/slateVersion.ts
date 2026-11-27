import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { SlateVersionStatus } from '../../../prisma/generated/client';
import { slateVersionPresenter } from '../../presenters';
import { slateDeploymentService, slateService, slateVersionService } from '../../services';
import { app } from './_app';
import { slateApp } from './slate';

export let slateVersionApp = slateApp.use(async ctx => {
  let slateVersionId = ctx.body.slateVersionId;
  if (!slateVersionId) throw new Error('Slate Version ID is required');

  let slateVersion = await slateVersionService.getSlateVersionById({
    id: slateVersionId,
    slate: ctx.slate
  });

  return { slateVersion };
});

let slateVersionStatus = v.enumOf(
  Object.values(SlateVersionStatus) as [SlateVersionStatus, ...SlateVersionStatus[]]
);

export let slateVersionController = app.controller({
  list: slateApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          slateId: v.string(),
          registryVersionIds: v.optional(v.array(v.string())),
          status: v.optional(v.array(slateVersionStatus))
        })
      )
    )
    .do(async ctx => {
      let paginator = await slateVersionService.listSlateVersions({
        slate: ctx.slate,
        registryVersionIds: ctx.input.registryVersionIds,
        status: ctx.input.status
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, slateVersionPresenter);
    }),

  get: slateVersionApp
    .handler()
    .input(
      v.object({
        slateId: v.string(),
        slateVersionId: v.string()
      })
    )
    .do(async ctx => slateVersionPresenter(ctx.slateVersion)),

  getRegistryRecord: slateVersionApp
    .handler()
    .input(
      v.object({
        slateId: v.string(),
        slateVersionId: v.string()
      })
    )
    .do(
      async ctx =>
        await slateVersionService.getSlateVersionRegistryRecord({
          slateVersion: ctx.slateVersion
        })
    ),

  listIssues: app
    .handler()
    .input(
      Paginator.validate(
        v.object({
          slateId: v.optional(v.string()),
          stalledAfterMinutes: v.optional(v.number())
        })
      )
    )
    .do(async ctx => {
      let slate = ctx.input.slateId
        ? await slateService.getSlateById({ id: ctx.input.slateId })
        : undefined;

      let paginator = await slateVersionService.listSlateVersionIssues({
        slate,
        stalledAfterMinutes: ctx.input.stalledAfterMinutes ?? 30
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, slateVersionPresenter);
    }),

  deploy: slateVersionApp
    .handler()
    .input(
      v.object({
        slateId: v.string(),
        slateVersionId: v.string(),
        requestedBy: v.optional(v.string())
      })
    )
    .do(async ctx => {
      let { queuedAt } = await slateDeploymentService.deployVersion({
        slateVersion: ctx.slateVersion,
        requestedBy: ctx.input.requestedBy
      });

      return { object: 'slate.version.deploy', slateVersionId: ctx.slateVersion.id, queuedAt };
    }),

  getMany: app
    .handler()
    .input(
      v.object({
        slateVersionIds: v.array(v.string())
      })
    )
    .do(async ctx => {
      let slateVersions = await slateVersionService.getManySlateVersionsByIds({
        ids: ctx.input.slateVersionIds
      });

      return slateVersions.map(slateVersionPresenter);
    })
});
