import { Paginator } from '@mtsrc/pagination';
import { v } from '@mtsrc/validation';
import { fileReferencePresenter } from '../presenters';
import { fileReferenceService } from '@metorial-cargo/module-file';
import { app } from './_app';
import { dateFilterSchema } from './_dateFilter';
import { fileApp } from './file';
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

  hasReferences: fileLinkApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        fileLinkId: v.string()
      })
    )
    .do(async ctx => ({
      hasReferences: await fileReferenceService.hasReferences({
        fileLink: ctx.fileLink
      })
    })),

  hasReferencesForFile: fileApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        fileId: v.string()
      })
    )
    .do(async ctx => ({
      hasReferences: await fileReferenceService.hasReferencesForFile({
        file: ctx.file
      })
    })),

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
          fileReferenceIds: v.optional(v.array(v.string())),
          fileLinkId: v.optional(v.string()),
          fileLinkIds: v.optional(v.array(v.string())),
          fileIds: v.optional(v.array(v.string())),
          entityType: v.optional(v.string()),
          entityId: v.optional(v.string()),
          entityIds: v.optional(v.array(v.string())),
          createdAt: dateFilterSchema
        })
      )
    )
    .do(async ctx => {
      let paginator = await fileReferenceService.listFileReferences({
        tenant: ctx.tenant,
        environment: ctx.environment,
        ids: ctx.input.fileReferenceIds,
        fileLinkId: ctx.input.fileLinkId,
        fileLinkIds: ctx.input.fileLinkIds,
        fileIds: ctx.input.fileIds,
        entityType: ctx.input.entityType,
        entityId: ctx.input.entityId,
        entityIds: ctx.input.entityIds,
        createdAt: ctx.input.createdAt
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
