import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { ssoConnectionService } from '../../../../services/sso/connection';
import { ssoDirectoryService } from '../../../../services/sso/directory';
import { ssoDirectoryPresenter } from '../../presenters';
import { tenantApp } from './_middleware';

export let ssoDirectoriesController = tenantApp.controller({
  create: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        connectionId: v.string(),
        name: v.string(),
        type: v.string(),
        metadata: v.optional(v.record(v.any()))
      })
    )
    .do(async ({ input, tenant }) => {
      let connection = await ssoConnectionService.getConnectionById({
        tenant,
        connectionId: input.connectionId
      });
      let { directory, scim } = await ssoDirectoryService.createDirectory({
        tenant,
        connection,
        input: {
          name: input.name,
          type: input.type as any,
          metadata: input.metadata
        }
      });

      return {
        directory: ssoDirectoryPresenter(directory),
        scim: {
          path: scim.path ?? directory.scimPath,
          endpoint: scim.endpoint ?? directory.scimEndpoint,
          scimSecret: scim.secret ?? directory.scimSecret
        }
      };
    }),

  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          userIds: v.optional(v.array(v.string())),
          userProfileIds: v.optional(v.array(v.string())),
          connectionIds: v.optional(v.array(v.string())),
          directoryIds: v.optional(v.array(v.string())),
          statuses: v.optional(v.array(v.string()))
        })
      )
    )
    .do(async ({ input, tenant }) => {
      let paginator = await ssoDirectoryService.listDirectories({
        tenant,
        filters: input
      });
      let list = await paginator.run(input);
      return Paginator.presentLight(list, ssoDirectoryPresenter);
    }),

  get: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        directoryId: v.string()
      })
    )
    .do(async ({ input, tenant }) => {
      let directory = await ssoDirectoryService.getTenantDirectoryById({
        tenant,
        directoryId: input.directoryId
      });
      return ssoDirectoryPresenter(directory);
    }),

  update: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        directoryId: v.string(),
        name: v.optional(v.string()),
        metadata: v.optional(v.record(v.any())),
        status: v.optional(v.enumOf(['disabled']))
      })
    )
    .do(async ({ input, tenant }) => {
      let directory = await ssoDirectoryService.getTenantDirectoryById({
        tenant,
        directoryId: input.directoryId
      });
      let updated = await ssoDirectoryService.updateDirectory({
        tenant,
        directory,
        input: {
          name: input.name,
          metadata: input.metadata,
          status: input.status
        }
      });
      return ssoDirectoryPresenter(updated);
    }),

  delete: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        directoryId: v.string()
      })
    )
    .do(async ({ input, tenant }) => {
      let directory = await ssoDirectoryService.getTenantDirectoryById({
        tenant,
        directoryId: input.directoryId
      });
      let deleted = await ssoDirectoryService.deleteDirectory({ tenant, directory });
      return ssoDirectoryPresenter(deleted);
    })
});
