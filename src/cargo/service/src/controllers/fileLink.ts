import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { fileLinkPresenter, filePresenter } from '../presenters';
import { fileLinkService } from '@metorial-cargo/module-file';
import { app } from './_app';
import { dateFilterSchema } from './_dateFilter';
import { fileApp } from './file';
import { tenantApp } from './tenant';

export let fileLinkApp = tenantApp.use(async ctx => {
  let fileLinkId = ctx.body.fileLinkId;
  if (!fileLinkId) throw new Error('File link ID is required');

  let fileLink = await fileLinkService.getFileLinkById({
    tenant: ctx.tenant,
    environment: ctx.environment,
    fileLinkId
  });

  return { fileLink };
});

export let fileLinkController = app.controller({
  getByKey: app
    .handler()
    .input(
      v.object({
        fileId: v.string(),
        key: v.string()
      })
    )
    .do(async ctx => {
      let { link, file } = await fileLinkService.getFileLinkByKey({
        fileId: ctx.input.fileId,
        key: ctx.input.key
      });

      return {
        link: fileLinkPresenter(link),
        file: filePresenter(file)
      };
    }),

  create: fileApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        fileId: v.string(),
        fileLinkId: v.optional(v.string()),
        key: v.optional(v.string()),
        expiresAt: v.optional(v.date()),
        actorId: v.optional(v.string())
      })
    )
    .do(async ctx => {
      let fileLink = await fileLinkService.createFileLink({
        tenant: ctx.tenant,
        environment: ctx.environment,
        file: ctx.file,
        input: {
          id: ctx.input.fileLinkId,
          key: ctx.input.key,
          expiresAt: ctx.input.expiresAt,
          actorId: ctx.input.actorId
        }
      });

      return fileLinkPresenter(fileLink);
    }),

  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),
          fileLinkIds: v.optional(v.array(v.string())),
          fileIds: v.optional(v.array(v.string())),
          actorId: v.optional(v.string()),
          actorIds: v.optional(v.array(v.string())),
          createdAt: dateFilterSchema,
          expiresAt: dateFilterSchema
        })
      )
    )
    .do(async ctx => {
      let paginator = await fileLinkService.listFileLinks({
        tenant: ctx.tenant,
        environment: ctx.environment,
        ids: ctx.input.fileLinkIds,
        fileId: ctx.input.fileIds,
        actorId: ctx.input.actorId,
        actorIds: ctx.input.actorIds,
        createdAt: ctx.input.createdAt,
        expiresAt: ctx.input.expiresAt
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, fileLinkPresenter);
    }),

  get: fileLinkApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        fileLinkId: v.string(),
        actorId: v.optional(v.string())
      })
    )
    .do(async ctx =>
      fileLinkPresenter(
        await fileLinkService.getFileLinkById({
          tenant: ctx.tenant,
          environment: ctx.environment,
          fileLinkId: ctx.input.fileLinkId,
          actorId: ctx.input.actorId
        })
      )
    ),

  delete: fileLinkApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        fileLinkId: v.string()
      })
    )
    .do(async ctx => {
      let fileLink = await fileLinkService.deleteFileLink({
        fileLink: ctx.fileLink
      });

      return fileLinkPresenter(fileLink);
    })
});
