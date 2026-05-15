import { badRequestError, ServiceError } from '@lowerdeck/error';
import { v } from '@lowerdeck/validation';
import { env } from '../env';
import { codeBucketPresenter } from '../presenters/codeBucket';
import {
  codeBucketFileContentPresenter,
  codeBucketFileInfoPresenter
} from '../presenters/codeBucketFile';
import { codeBucketService, scmRepoService } from '../services';
import { app } from './_app';
import { tenantApp } from './tenant';

export let codeBucketApp = tenantApp.use(async ctx => {
  let codeBucketId = ctx.body.codeBucketId;
  if (!codeBucketId) throw new Error('Code Bucket ID is required');

  let codeBucket = await codeBucketService.getCodeBucketById({
    id: codeBucketId,
    tenant: ctx.tenant
  });

  return { codeBucket };
});

export let codeBucketController = app.controller({
  create: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        purpose: v.string(),
        isReadOnly: v.optional(v.boolean()),
        files: v.optional(
          v.array(
            v.object({
              path: v.string(),
              data: v.string(),
              encoding: v.enumOf(['utf-8', 'base64'])
            })
          )
        )
      })
    )
    .do(async ctx => {
      let codeBucket = await codeBucketService.createCodeBucket({
        tenant: ctx.tenant,
        purpose: ctx.input.purpose,
        isReadOnly: ctx.input.isReadOnly,
        files: ctx.input.files
      });

      return codeBucketPresenter(codeBucket);
    }),

  clone: codeBucketApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        codeBucketId: v.string(),
        isReadOnly: v.optional(v.boolean())
      })
    )
    .do(async ctx => {
      let clonedBucket = await codeBucketService.cloneCodeBucket({
        codeBucket: ctx.codeBucket,
        isReadOnly: ctx.input.isReadOnly
      });

      return codeBucketPresenter(clonedBucket);
    }),

  createFromRepo: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        scmRepoId: v.string(),
        purpose: v.string(),
        path: v.optional(v.string()),
        ref: v.optional(v.string()),
        isReadOnly: v.optional(v.boolean()),
        isSynced: v.optional(v.boolean())
      })
    )
    .do(async ctx => {
      let repo = await scmRepoService.getScmRepoById({
        tenant: ctx.tenant,
        scmRepoId: ctx.input.scmRepoId
      });

      let codeBucket = await codeBucketService.createCodeBucketFromRepo({
        tenant: ctx.tenant,
        purpose: ctx.input.purpose,
        repo,
        path: ctx.input.path,
        ref: ctx.input.ref,
        isReadOnly: ctx.input.isReadOnly,
        isSynced: ctx.input.isSynced
      });

      return codeBucketPresenter(codeBucket);
    }),

  syncBuckets: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),

        sourceCodeBucketId: v.string(),
        targetCodeBucketId: v.string()
      })
    )
    .do(async ctx => {
      let source = await codeBucketService.getCodeBucketById({
        id: ctx.input.sourceCodeBucketId,
        tenant: ctx.tenant
      });
      let target = await codeBucketService.getCodeBucketById({
        id: ctx.input.targetCodeBucketId,
        tenant: ctx.tenant
      });

      await codeBucketService.syncCodeBuckets({ source, target });

      return { success: true };
    }),

  enableSyncFromRepo: codeBucketApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        codeBucketId: v.string()
      })
    )
    .do(async ctx => {
      if (!ctx.codeBucket.repositoryOid) {
        throw new ServiceError(
          badRequestError({
            message: 'Code bucket is not linked to a repository'
          })
        );
      }

      let repo = await scmRepoService.getScmRepoById({
        tenant: ctx.tenant,
        scmRepoId: ctx.codeBucket.repository!.id
      });

      await codeBucketService.syncCodeBucketFromRepo({
        codeBucket: ctx.codeBucket,
        repo
      });

      return { success: true };
    }),

  get: codeBucketApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        codeBucketId: v.string()
      })
    )
    .do(async ctx => codeBucketPresenter(ctx.codeBucket)),

  getEditorToken: codeBucketApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        codeBucketId: v.string(),
        isReadOnly: v.optional(v.boolean())
      })
    )
    .do(async ctx => {
      let token = await codeBucketService.getEditorToken({
        codeBucket: ctx.codeBucket,
        isReadOnly: ctx.codeBucket.isReadOnly || ctx.input.isReadOnly
      });

      let url = new URL(env.codeBucket.CODE_BUCKET_EDITOR_URL);
      url.searchParams.set('id', ctx.codeBucket.id);
      url.searchParams.set('token', token.token);

      return {
        url: url.toString(),
        ...token
      };
    }),

  getFile: codeBucketApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        codeBucketId: v.string(),
        path: v.string()
      })
    )
    .do(async ctx => {
      let file = await codeBucketService.getFile({
        codeBucket: ctx.codeBucket,
        path: ctx.input.path
      });
      return codeBucketFileContentPresenter(file);
    }),

  getFiles: codeBucketApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        codeBucketId: v.string(),
        prefix: v.optional(v.string()),
        excludeContents: v.optional(v.boolean())
      })
    )
    .do(async ctx => {
      if (ctx.input.excludeContents) {
        let files = await codeBucketService.getCodeBucketFiles({
          codeBucket: ctx.codeBucket,
          prefix: ctx.input.prefix
        });
        return {
          files: files.map(codeBucketFileInfoPresenter)
        };
      } else {
        let files = await codeBucketService.getCodeBucketFilesWithContent({
          codeBucket: ctx.codeBucket,
          prefix: ctx.input.prefix
        });
        return {
          files: files.map(codeBucketFileContentPresenter)
        };
      }
    }),

  setFiles: codeBucketApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        codeBucketId: v.string(),
        files: v.array(
          v.object({
            path: v.string(),
            data: v.string(),
            encoding: v.enumOf(['utf-8', 'base64'])
          })
        )
      })
    )
    .do(async ctx => {
      if (ctx.codeBucket.isReadOnly) {
        throw new ServiceError(
          badRequestError({
            message: 'Cannot modify files in a read-only code bucket'
          })
        );
      }

      await codeBucketService.setFiles({
        codeBucket: ctx.codeBucket,
        files: ctx.input.files
      });

      return { success: true };
    }),

  setFile: codeBucketApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        codeBucketId: v.string(),
        path: v.string(),
        data: v.string(),
        encoding: v.enumOf(['utf-8', 'base64'])
      })
    )
    .do(async ctx => {
      if (ctx.codeBucket.isReadOnly) {
        throw new ServiceError(
          badRequestError({
            message: 'Cannot modify files in a read-only code bucket'
          })
        );
      }

      await codeBucketService.setFile({
        codeBucket: ctx.codeBucket,
        path: ctx.input.path,
        data: ctx.input.data,
        encoding: ctx.input.encoding
      });

      return { success: true };
    }),

  deleteFile: codeBucketApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        codeBucketId: v.string(),
        path: v.string()
      })
    )
    .do(async ctx => {
      if (ctx.codeBucket.isReadOnly) {
        throw new ServiceError(
          badRequestError({
            message: 'Cannot modify files in a read-only code bucket'
          })
        );
      }

      await codeBucketService.deleteFile({
        codeBucket: ctx.codeBucket,
        path: ctx.input.path
      });

      return { success: true };
    }),

  deletePath: codeBucketApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        codeBucketId: v.string(),
        path: v.string()
      })
    )
    .do(async ctx => {
      if (ctx.codeBucket.isReadOnly) {
        throw new ServiceError(
          badRequestError({
            message: 'Cannot modify files in a read-only code bucket'
          })
        );
      }

      await codeBucketService.deletePath({
        codeBucket: ctx.codeBucket,
        path: ctx.input.path
      });

      return { success: true };
    }),

  getAsZip: codeBucketApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        codeBucketId: v.string()
      })
    )
    .do(async ctx => {
      let result = await codeBucketService.getBucketFilesAsZip({
        codeBucket: ctx.codeBucket
      });

      return {
        downloadUrl: result.downloadUrl,
        expiresAt: new Date(result.expiresAt.toNumber() * 1000)
      };
    })
});
