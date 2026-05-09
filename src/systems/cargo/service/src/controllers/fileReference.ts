import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { fileReferencePresenter } from '../presenters';
import { fileReferenceService } from '../services';
import { app } from './_app';
import { fileLinkApp } from './fileLink';
import { tenantApp } from './tenant';

export let fileReferenceApp = tenantApp.use(async ctx => {
  let fileReferenceId = ctx.body.fileReferenceId;
  if (!fileReferenceId) throw new Error('File reference ID is required');

  let fileReference = await fileReferenceService.getFileReferenceById({
    tenant: ctx.tenant,
    environment: ctx.environment,
    fileReferenceId
  });

  return { fileReference };
});

export let fileReferenceController = app.controller({
  deleteAndCleanup: app
    .handler()
    .input(
      v.object({
        fileReferenceId: v.string()
      })
    )
    .do(async ctx => {
      await fileReferenceService.deleteFileReferenceByIdAndCleanup({
        fileReferenceId: ctx.input.fileReferenceId
      });

      return {};
    }),

  create: fileLinkApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        fileLinkId: v.string(),
        fileReferenceId: v.optional(v.string()),
        entityType: v.string(),
        entityId: v.string()
      })
    )
    .do(async ctx => {
      let fileReference = await fileReferenceService.upsertFileReference({
        tenant: ctx.tenant,
        environment: ctx.environment,
        fileLink: ctx.fileLink,
        input: {
          id: ctx.input.fileReferenceId,
          entityType: ctx.input.entityType,
          entityId: ctx.input.entityId
        }
      });

      return fileReferencePresenter(fileReference);
    }),

  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),
          fileLinkId: v.optional(v.string()),
          entityType: v.optional(v.string()),
          entityId: v.optional(v.string())
        })
      )
    )
    .do(async ctx => {
      let paginator = await fileReferenceService.listFileReferences({
        tenant: ctx.tenant,
        environment: ctx.environment,
        fileLinkId: ctx.input.fileLinkId,
        entityType: ctx.input.entityType,
        entityId: ctx.input.entityId
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, fileReferencePresenter);
    }),

  get: fileReferenceApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        fileReferenceId: v.string()
      })
    )
    .do(async ctx => fileReferencePresenter(ctx.fileReference)),

  delete: fileReferenceApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        fileReferenceId: v.string()
      })
    )
    .do(async ctx => {
      let fileReference = await fileReferenceService.deleteFileReference({
        fileReference: ctx.fileReference
      });

      return fileReferencePresenter(fileReference);
    })
});
