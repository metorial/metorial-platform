import { v } from '@mtsrc/validation';
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
        externalAccountId: v.optional(v.string())
      })
    )
    .do(async ctx => {
      let installation = await scmInstallationService.getScmInstallationById({
        tenant: ctx.tenant,
        scmInstallationId: ctx.input.scmInstallationId
      });

      let repos = await scmRepoService.listRepositoryPreviews({
        installation,
        externalAccountId: ctx.input.externalAccountId ?? installation.externalAccountId
      });

      return {
        repositories: repos.map(scmRepoPreviewPresenter)
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
        enableAutoMerge: v.optional(v.boolean())
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
        codeBucket,
        branchName: ctx.input.branchName,
        prName: ctx.input.prName,
        prDescription: ctx.input.prDescription,
        enableAutoMerge: ctx.input.enableAutoMerge
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
