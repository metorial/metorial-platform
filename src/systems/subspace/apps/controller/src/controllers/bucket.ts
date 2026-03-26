import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { bucketService } from '@metorial-subspace/module-custom-provider';
import { bucketPresenter } from '@metorial-subspace/presenters';
import { app } from './_app';
import { createdAtValidator, updatedAtValidator } from './_dateFilter';
import { tenantApp } from './tenant';

export let bucketApp = tenantApp.use(async ctx => {
  let bucketId = ctx.body.bucketId;
  if (!bucketId) throw new Error('Bucket ID is required');

  let bucket = await bucketService.getBucketById({
    bucketId,
    tenant: ctx.tenant,
    solution: ctx.solution,
    environment: ctx.environment
  });

  return { bucket };
});

export let bucketController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),

          ids: v.optional(v.array(v.string())),
          customProviderIds: v.optional(v.array(v.string())),
          customProviderVersionIds: v.optional(v.array(v.string())),
          customProviderDeploymentIds: v.optional(v.array(v.string())),

          createdAt: createdAtValidator,
          updatedAt: updatedAtValidator
        })
      )
    )
    .do(async ctx => {
      let paginator = await bucketService.listBuckets({
        tenant: ctx.tenant,
        environment: ctx.environment,
        solution: ctx.solution,

        ids: ctx.input.ids,
        customProviderIds: ctx.input.customProviderIds,
        customProviderVersionIds: ctx.input.customProviderVersionIds,
        customProviderDeploymentIds: ctx.input.customProviderDeploymentIds,

        createdAt: ctx.input.createdAt,
        updatedAt: ctx.input.updatedAt
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, bucketPresenter);
    }),

  get: bucketApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        bucketId: v.string()
      })
    )
    .do(async ctx => bucketPresenter(ctx.bucket)),

  getFile: bucketApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        bucketId: v.string(),

        filename: v.string()
      })
    )
    .do(
      async ctx =>
        await bucketService.getFileInBucket({
          tenant: ctx.tenant,
          bucket: ctx.bucket,
          filename: ctx.input.filename
        })
    ),

  getFiles: bucketApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        bucketId: v.string(),

        prefix: v.string()
      })
    )
    .do(
      async ctx =>
        await bucketService.getFilesInBucket({
          tenant: ctx.tenant,
          bucket: ctx.bucket,
          prefix: ctx.input.prefix
        })
    ),

  putFile: bucketApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        bucketId: v.string(),

        filename: v.string(),
        content: v.string(),
        encoding: v.enumOf(['utf-8', 'base64'])
      })
    )
    .do(
      async ctx =>
        await bucketService.setFileInBucket({
          tenant: ctx.tenant,
          bucket: ctx.bucket,
          filename: ctx.input.filename,
          content: ctx.input.content,
          encoding: ctx.input.encoding
        })
    ),

  getZipUrl: bucketApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        bucketId: v.string()
      })
    )
    .do(
      async ctx =>
        await bucketService.getZipUrl({
          tenant: ctx.tenant,
          bucket: ctx.bucket
        })
    ),

  getEditorUrl: bucketApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        bucketId: v.string()
      })
    )
    .do(
      async ctx =>
        await bucketService.getEditorUrl({
          tenant: ctx.tenant,
          bucket: ctx.bucket
        })
    )
});
