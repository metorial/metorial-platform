import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { SlateVersionDiscoveryStatus } from '../../../prisma/generated/client';
import { slateVersionDiscoveryPresenter } from '../../presenters/slateDiscovery';
import { slateDiscoveryBuildOutputPresenter } from '../../presenters/slateDiscoveryBuildOutput';
import { slateDiscoveryToolCallStatsPresenter } from '../../presenters/slateDiscoveryToolCallStats';
import { slateSpecificationPresenter } from '../../presenters/slateSpecification';
import { slateService } from '../../services';
import { slateVersionDiscoveryService } from '../../services/slateDiscovery';
import { slateSpecificationService } from '../../services/slateSpecification';
import { app } from './_app';
import { slateVersionApp } from './slateVersion';

export let slateDiscoveryApp = slateVersionApp.use(async ctx => {
  let slateDiscoveryId = ctx.body.slateDiscoveryId;
  if (!slateDiscoveryId) throw new Error('Slate Discovery ID is required');

  let slateDiscovery = await slateVersionDiscoveryService.getSlateVersionDiscoveryById({
    id: slateDiscoveryId,
    slateVersion: ctx.slateVersion
  });

  return { slateDiscovery };
});

export let slateDiscoveryController = app.controller({
  list: app
    .handler()
    .input(
      Paginator.validate(
        v.object({
          slateId: v.optional(v.string()),
          versionIds: v.optional(v.array(v.string())),
          status: v.optional(v.enumOf(Object.values(SlateVersionDiscoveryStatus) as [SlateVersionDiscoveryStatus, ...SlateVersionDiscoveryStatus[]]))
        })
      )
    )
    .do(async ctx => {
      let slate = ctx.input.slateId
        ? await slateService.getSlateById({ id: ctx.input.slateId })
        : undefined;

      let paginator = await slateVersionDiscoveryService.listSlateVersionDiscoveries({
        slate,
        versionIds: ctx.input.versionIds,
        status: ctx.input.status
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, slateVersionDiscoveryPresenter);
    }),

  get: slateDiscoveryApp
    .handler()
    .input(
      v.object({
        slateId: v.string(),
        slateVersionId: v.string(),
        slateDiscoveryId: v.string()
      })
    )
    .do(async ctx => slateVersionDiscoveryPresenter(ctx.slateDiscovery)),

  getBuildOutput: slateDiscoveryApp
    .handler()
    .input(
      v.object({
        slateId: v.string(),
        slateVersionId: v.string(),
        slateDiscoveryId: v.string()
      })
    )
    .do(async ctx => {
      let res = await slateVersionDiscoveryService.getBuildOutput({
        slateVersionDiscovery: ctx.slateDiscovery
      });

      return slateDiscoveryBuildOutputPresenter(res);
    }),

  getSpecification: slateDiscoveryApp
    .handler()
    .input(
      v.object({
        slateId: v.string(),
        slateVersionId: v.string(),
        slateDiscoveryId: v.string()
      })
    )
    .do(async ctx => {
      if (!ctx.slateDiscovery.specification?.id) return null;

      let specification = await slateSpecificationService.getSlateSpecificationById({
        id: ctx.slateDiscovery.specification.id
      });

      return slateSpecificationPresenter({ ...specification, slate: ctx.slate });
    }),

  getToolCallStats: slateDiscoveryApp
    .handler()
    .input(
      v.object({
        slateId: v.string(),
        slateVersionId: v.string(),
        slateDiscoveryId: v.string()
      })
    )
    .do(async ctx => {
      let stats = await slateVersionDiscoveryService.getToolCallStats({
        slateVersionDiscovery: ctx.slateDiscovery
      });

      return slateDiscoveryToolCallStatsPresenter(stats);
    })
});
