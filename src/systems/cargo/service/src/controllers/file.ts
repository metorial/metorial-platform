import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { normalizeArrayParam } from '../../../../../backend/apis/core/src/lib/normalizeArrayParam';
import { getSignedFileDownloadUrl } from '../lib/signedDownloadUrl';
import { filePresenter } from '../presenters';
import { fileService } from '../services';
import { app } from './_app';
import { storePermissionsSchema, storeShortcutSchema } from './document';
import { tenantApp } from './tenant';

let filePresenterWithSignedDownloadUrl = async (file: Parameters<typeof filePresenter>[0]) =>
  filePresenter(file, {
    signedDownloadUrl: await getSignedFileDownloadUrl(file)
  });

export let fileApp = tenantApp.use(async ctx => {
  let fileId = ctx.body.fileId;
  if (!fileId) throw new Error('File ID is required');

  let file = await fileService.getFileById({
    tenant: ctx.tenant,
    environment: ctx.environment,
    fileId
  });

  return { file };
});

export let fileController = app.controller({
  create: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        fileId: v.optional(v.string()),
        purpose: v.string(),
        storeId: v.string(),
        name: v.string(),
        mimeType: v.string(),
        size: v.number(),
        title: v.optional(v.string()),
        actorId: v.optional(v.string()),
        store: v.optional(storeShortcutSchema),
        defaultPermissions: v.optional(storePermissionsSchema),
        overridePermissions: v.optional(v.boolean())
      })
    )
    .do(async ctx => {
      let file = await fileService.createFile({
        tenant: ctx.tenant,
        environment: ctx.environment,
        purpose: ctx.input.purpose,
        storeId: ctx.input.storeId,
        input: {
          id: ctx.input.fileId,
          name: ctx.input.name,
          mimeType: ctx.input.mimeType,
          size: ctx.input.size,
          title: ctx.input.title,
          actorId: ctx.input.actorId,
          store: ctx.input.store,
          defaultPermissions: ctx.input.defaultPermissions,
          overridePermissions: ctx.input.overridePermissions
        }
      });

      return await filePresenterWithSignedDownloadUrl(file);
    }),

  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),
          purpose: v.optional(v.union([v.string(), v.array(v.string())])),
          includeDeleted: v.optional(v.boolean()),
          actorId: v.optional(v.string()),
          defaultPermissions: v.optional(storePermissionsSchema),
          overridePermissions: v.optional(v.boolean())
        })
      )
    )
    .do(async ctx => {
      let purpose = normalizeArrayParam(ctx.input.purpose);

      let paginator = await fileService.listFiles({
        tenant: ctx.tenant,
        environment: ctx.environment,
        purpose,
        includeDeleted: ctx.input.includeDeleted,
        actorId: ctx.input.actorId,
        defaultPermissions: ctx.input.defaultPermissions,
        overridePermissions: ctx.input.overridePermissions
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, filePresenter);
    }),

  get: fileApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        fileId: v.string(),
        actorId: v.optional(v.string()),
        defaultPermissions: v.optional(storePermissionsSchema),
        overridePermissions: v.optional(v.boolean())
      })
    )
    .do(
      async ctx =>
        await filePresenterWithSignedDownloadUrl(
          await fileService.getFileById({
            tenant: ctx.tenant,
            environment: ctx.environment,
            fileId: ctx.input.fileId,
            actorId: ctx.input.actorId,
            defaultPermissions: ctx.input.defaultPermissions,
            overridePermissions: ctx.input.overridePermissions
          })
        )
    ),

  update: fileApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        fileId: v.string(),
        title: v.optional(v.string())
      })
    )
    .do(async ctx => {
      let file = await fileService.updateFile({
        file: ctx.file,
        input: {
          title: ctx.input.title
        }
      });

      return await filePresenterWithSignedDownloadUrl(file);
    }),

  delete: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        fileId: v.string(),
        actorId: v.optional(v.string()),
        defaultPermissions: v.optional(storePermissionsSchema),
        overridePermissions: v.optional(v.boolean())
      })
    )
    .do(async ctx => {
      let file = await fileService.deleteFileById({
        tenant: ctx.tenant,
        environment: ctx.environment,
        fileId: ctx.input.fileId,
        actorId: ctx.input.actorId,
        defaultPermissions: ctx.input.defaultPermissions,
        overridePermissions: ctx.input.overridePermissions
      });

      return await filePresenterWithSignedDownloadUrl(file);
    })
});
