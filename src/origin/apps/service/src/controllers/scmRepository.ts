import { v } from '@lowerdeck/validation';
import { env } from '../env';
import { assertManifestSyncAllowed } from '../lib/manifestSyncPolicy';
import { scmRepositoryPushPresenter, scmRepositorySyncPresenter } from '../presenters';
import { repositoryPresenter } from '../presenters/repository';
import {
  scmAccountPreviewPresenter,
  scmRepoPreviewPresenter
} from '../presenters/scmRepoPreview';
import {
  actorService,
  codeBucketService,
  scmInstallationService,
  scmRepoService,
  scmRepositorySyncService
} from '../services';
import { app } from './_app';
import { tenantApp } from './tenant';

let MANIFEST_KEY_PREFIX = 'skill-sync/manifests/';
let MAX_MANIFEST_ENTRIES = 250_000;
let DEFAULT_DELETION_GUARD = { maxUnexpectedDeletes: 250, maxUnexpectedDeleteRatio: 0.1 };

let syncKey = v.string({ modifiers: [v.minLength(1), v.maxLength(200)] });
let sha256Hex = v.string({
  modifiers: [v.regex(/^[0-9a-f]{64}$/, { message: 'Must be 64 lowercase hex characters' })]
});
let manifestKey = v.string({
  modifiers: [
    v.startsWith(MANIFEST_KEY_PREFIX, { message: `Must start with ${MANIFEST_KEY_PREFIX}` }),
    v.maxLength(1024)
  ]
});

export let scmRepositoryApp = tenantApp.use(async ctx => {
  let scmRepositoryId = ctx.body.scmRepositoryId;
  if (!scmRepositoryId) throw new Error('SCM Repository ID is required');

  let scmRepository = await scmRepoService.getScmRepoById({
    tenant: ctx.tenant,
    scmRepoId: scmRepositoryId
  });

  return { scmRepository };
});

export let scmRepositoryController = app.controller({
  listAccountPreviews: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        scmInstallationId: v.string()
      })
    )
    .do(async ctx => {
      let installation = await scmInstallationService.getScmInstallationById({
        tenant: ctx.tenant,
        scmInstallationId: ctx.input.scmInstallationId
      });

      let accounts = await scmRepoService.listAccountPreviews({ installation });

      return {
        accounts: accounts.map(scmAccountPreviewPresenter)
      };
    }),

  listRepositoryPreviews: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        scmInstallationId: v.string(),
        externalAccountId: v.optional(v.string()),
        cursor: v.optional(v.string()),
        limit: v.optional(
          v.number({
            modifiers: [v.minValue(1), v.maxValue(100)]
          })
        )
      })
    )
    .do(async ctx => {
      let installation = await scmInstallationService.getScmInstallationById({
        tenant: ctx.tenant,
        scmInstallationId: ctx.input.scmInstallationId
      });

      let result = await scmRepoService.listRepositoryPreviews({
        installation,
        externalAccountId: ctx.input.externalAccountId ?? installation.externalAccountId,
        cursor: ctx.input.cursor,
        limit: ctx.input.limit
      });

      return {
        repositories: result.repositories.map(scmRepoPreviewPresenter),
        nextCursor: result.nextCursor
      };
    }),

  link: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        scmInstallationId: v.string(),
        externalId: v.string()
      })
    )
    .do(async ctx => {
      let installation = await scmInstallationService.getScmInstallationById({
        tenant: ctx.tenant,
        scmInstallationId: ctx.input.scmInstallationId
      });

      let repo = await scmRepoService.linkRepository({
        installation,
        externalId: ctx.input.externalId
      });

      return repositoryPresenter(repo);
    }),

  create: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        scmInstallationId: v.string(),
        externalAccountId: v.string(),
        name: v.string(),
        description: v.optional(v.string()),
        isPrivate: v.boolean()
      })
    )
    .do(async ctx => {
      let installation = await scmInstallationService.getScmInstallationById({
        tenant: ctx.tenant,
        scmInstallationId: ctx.input.scmInstallationId
      });

      let repo = await scmRepoService.createRepository({
        installation,
        externalAccountId: ctx.input.externalAccountId,
        name: ctx.input.name,
        description: ctx.input.description,
        isPrivate: ctx.input.isPrivate
      });

      return repositoryPresenter(repo);
    }),

  searchAndLinkRepo: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        actorId: v.string(),
        repositoryUrl: v.string()
      })
    )
    .do(async ctx => {
      let actor = await actorService.getActorById({ id: ctx.input.actorId });

      let repo = await scmRepoService.searchAndLinkRepositoryByUrl({
        tenant: ctx.tenant,
        actor,
        repositoryUrl: ctx.input.repositoryUrl
      });

      return repositoryPresenter(repo);
    }),

  get: scmRepositoryApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        scmRepositoryId: v.string()
      })
    )
    .do(async ctx => repositoryPresenter(ctx.scmRepository)),

  getMany: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        scmRepositoryIds: v.array(v.string())
      })
    )
    .do(async ctx => {
      let repos = await scmRepoService.getManyScmReposByIds({
        tenant: ctx.tenant,
        scmRepoIds: ctx.input.scmRepositoryIds
      });

      return {
        repositories: repos.map(repositoryPresenter)
      };
    }),

  syncCodeBucket: scmRepositoryApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        scmRepositoryId: v.string(),
        codeBucketId: v.string(),
        repositoryAccessMode: v.enumOf(['pull_request', 'default_branch']),
        requestKey: v.optional(v.string()),
        branchName: v.optional(v.string()),
        prName: v.optional(v.string()),
        prDescription: v.optional(v.string()),
        commitMessage: v.optional(v.string()),
        enableAutoMerge: v.optional(v.boolean()),
        forceMergeOrPush: v.optional(v.boolean()),
        mergeBeforeChecksPass: v.optional(v.boolean()),
        deletePaths: v.optional(v.array(v.string())),
        explicitDeletesOnly: v.optional(v.boolean()),
        gitLfsThresholdBytes: v.optional(v.number({ modifiers: [v.positive(), v.integer()] }))
      })
    )
    .do(async ctx => {
      let codeBucket = await codeBucketService.getCodeBucketById({
        tenant: ctx.tenant,
        id: ctx.input.codeBucketId
      });

      let sync = await scmRepositorySyncService.createScmRepositorySync({
        tenant: ctx.tenant,
        repo: ctx.scmRepository,
        source: { type: 'code_bucket', codeBucket },
        repositoryAccessMode: ctx.input.repositoryAccessMode,
        requestKey: ctx.input.requestKey,
        branchName: ctx.input.branchName,
        prName: ctx.input.prName,
        prDescription: ctx.input.prDescription,
        commitMessage: ctx.input.commitMessage,
        enableAutoMerge: ctx.input.enableAutoMerge,
        forceMergeOrPush: ctx.input.forceMergeOrPush,
        mergeBeforeChecksPass: ctx.input.mergeBeforeChecksPass,
        deletePaths: ctx.input.deletePaths,
        explicitDeletesOnly: ctx.input.explicitDeletesOnly,
        gitLfsThresholdBytes: ctx.input.gitLfsThresholdBytes
      });

      return scmRepositorySyncPresenter(sync);
    }),

  syncManifest: scmRepositoryApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        scmRepositoryId: v.string(),
        requestKey: syncKey,
        sourceKey: syncKey,
        manifest: v.object({
          bucket: v.string({ modifiers: [v.minLength(1)] }),
          key: manifestKey,
          sha256: sha256Hex,
          entryCount: v.number({
            modifiers: [v.integer(), v.minValue(0), v.maxValue(MAX_MANIFEST_ENTRIES)]
          })
        }),
        previousManifest: v.optional(
          v.object({
            bucket: v.string({ modifiers: [v.minLength(1)] }),
            key: manifestKey,
            sha256: sha256Hex
          })
        ),
        deletionGuard: v.optional(
          v.object({
            maxUnexpectedDeletes: v.number({
              modifiers: [v.integer(), v.minValue(0), v.maxValue(100_000)]
            }),
            maxUnexpectedDeleteRatio: v.number({ modifiers: [v.minValue(0), v.maxValue(1)] })
          })
        ),
        allowMassDelete: v.optional(v.boolean()),
        repositoryAccessMode: v.enumOf(['pull_request', 'default_branch']),
        branchName: v.optional(v.string()),
        prName: v.optional(v.string()),
        prDescription: v.optional(v.string()),
        commitMessage: v.optional(v.string()),
        enableAutoMerge: v.optional(v.boolean()),
        forceMergeOrPush: v.optional(v.boolean()),
        mergeBeforeChecksPass: v.optional(v.boolean()),
        gitLfsThresholdBytes: v.optional(v.number({ modifiers: [v.positive(), v.integer()] }))
      })
    )
    .do(async ctx => {
      assertManifestSyncAllowed(
        env.manifestSync,
        [ctx.input.manifest.bucket, ctx.input.previousManifest?.bucket].filter(
          (bucket): bucket is string => !!bucket
        )
      );

      let sync = await scmRepositorySyncService.createScmRepositorySync({
        tenant: ctx.tenant,
        repo: ctx.scmRepository,
        source: {
          type: 'manifest',
          sourceKey: ctx.input.sourceKey,
          manifest: ctx.input.manifest,
          previousManifest: ctx.input.previousManifest
        },
        repositoryAccessMode: ctx.input.repositoryAccessMode,
        requestKey: ctx.input.requestKey,
        branchName: ctx.input.branchName,
        prName: ctx.input.prName,
        prDescription: ctx.input.prDescription,
        commitMessage: ctx.input.commitMessage,
        enableAutoMerge: ctx.input.enableAutoMerge,
        forceMergeOrPush: ctx.input.forceMergeOrPush,
        mergeBeforeChecksPass: ctx.input.mergeBeforeChecksPass,
        gitLfsThresholdBytes: ctx.input.gitLfsThresholdBytes,
        deletionGuard: ctx.input.deletionGuard ?? DEFAULT_DELETION_GUARD,
        allowMassDelete: ctx.input.allowMassDelete
      });

      return scmRepositorySyncPresenter(sync);
    }),

  syncCodeBucketToBranch: scmRepositoryApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        scmRepositoryId: v.string(),
        codeBucketId: v.string(),
        branchName: v.string(),
        prName: v.string(),
        prDescription: v.optional(v.string()),
        enableAutoMerge: v.optional(v.boolean()),
        forceMergeOrPush: v.optional(v.boolean()),
        mergeBeforeChecksPass: v.optional(v.boolean()),
        gitLfsThresholdBytes: v.optional(v.number({ modifiers: [v.positive(), v.integer()] }))
      })
    )
    .do(async ctx => {
      let codeBucket = await codeBucketService.getCodeBucketById({
        tenant: ctx.tenant,
        id: ctx.input.codeBucketId
      });

      let sync = await scmRepositorySyncService.createScmRepositorySync({
        tenant: ctx.tenant,
        repo: ctx.scmRepository,
        source: { type: 'code_bucket', codeBucket },
        repositoryAccessMode: 'pull_request',
        branchName: ctx.input.branchName,
        prName: ctx.input.prName,
        prDescription: ctx.input.prDescription,
        enableAutoMerge: ctx.input.enableAutoMerge,
        forceMergeOrPush: ctx.input.forceMergeOrPush,
        mergeBeforeChecksPass: ctx.input.mergeBeforeChecksPass,
        gitLfsThresholdBytes: ctx.input.gitLfsThresholdBytes
      });

      return scmRepositorySyncPresenter(sync);
    }),

  triggerPush: scmRepositoryApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        scmRepositoryId: v.string(),
        branchName: v.optional(v.string())
      })
    )
    .do(async ctx => {
      let push = await scmRepoService.createPushForCurrentCommitOnDefaultBranch({
        repo: ctx.scmRepository,
        branchName: ctx.input.branchName
      });

      if (!push) {
        return {
          success: false
        };
      }

      return {
        success: true,
        push: scmRepositoryPushPresenter(push)
      };
    })
});
