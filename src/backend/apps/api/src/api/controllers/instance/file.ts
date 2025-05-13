import { fileService, purposeSlugs } from '@metorial/module-file';
import { organizationService } from '@metorial/module-organization';
import { Paginator } from '@metorial/pagination';
import { Controller, Path } from '@metorial/rest';
import { v } from '@metorial/validation';
import { apiGroup } from '../../middleware/apiGroup';
import { checkAccess } from '../../middleware/checkAccess';
import { filePresenter } from '../../presenters';

export let fileGroup = apiGroup.use(async ctx => {
  let file = await fileService.getFileById({
    fileId: ctx.params.fileId,
    owner:
      ctx.auth.type == 'machine'
        ? ctx.auth.restrictions.type == 'organization'
          ? {
              type: 'organization',
              organization: ctx.auth.restrictions.organization
            }
          : {
              type: 'instance',
              instance: ctx.auth.restrictions.instance,
              organization: ctx.auth.restrictions.organization
            }
        : {
            type: 'user',
            user: ctx.auth.user
          }
  });

  return { file };
});

export let filePath = (path: string, sdkPath: string) => [
  Path(`/files${path}`, `files.${sdkPath}`),
  Path(`/dashboard/files${path}`, `dashboard.files.${sdkPath}`)
];

export let fileController = Controller.create(
  {
    name: 'File',
    description: 'Read and write file information'
  },
  {
    list: apiGroup
      .get(filePath('', 'list'), {
        name: 'List  files',
        description: 'List all  files'
      })
      .use(checkAccess({ possibleScopes: ['instance.file:read'] }))
      .outputList(filePresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            purpose: v.optional(v.enumOf(purposeSlugs as any)),
            organization_id: v.optional(v.string())
          })
        )
      )
      .do(async ctx => {
        let paginator = await fileService.listFiles({
          owner:
            ctx.auth.type == 'machine'
              ? {
                  type: 'organization',
                  organization: ctx.auth.restrictions.organization
                }
              : (ctx.query as any).organization_id
                ? {
                    type: 'organization',
                    organization: (
                      await organizationService.getOrganizationByIdForUser({
                        organizationId: (ctx.query as any).organization_id,
                        user: ctx.auth.user
                      })
                    ).organization
                  }
                : {
                    type: 'user',
                    user: ctx.auth.user
                  }
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, file => filePresenter.present({ file }));
      }),

    get: fileGroup
      .get(filePath('/:fileId', 'get'), {
        name: 'Get file',
        description: 'Get the information of a specific file'
      })
      .use(checkAccess({ possibleScopes: ['instance.file:read'] }))
      .output(filePresenter)
      .do(async ctx => {
        return filePresenter.present({ file: ctx.file });
      }),

    update: fileGroup
      .patch(filePath('/:fileId', 'update'), {
        name: 'Update file',
        description: 'Update the information of a specific file'
      })
      .use(checkAccess({ possibleScopes: ['instance.file:write'] }))
      .body(
        'default',
        v.object({
          title: v.optional(v.string())
        })
      )
      .output(filePresenter)
      .do(async ctx => {
        let file = await fileService.updateFile({
          input: {
            title: ctx.body.title
          },
          file: ctx.file
        });

        return filePresenter.present({ file });
      }),

    delete: fileGroup
      .delete(filePath('/:fileId', 'delete'), {
        name: 'Delete file',
        description: 'Delete a specific file'
      })
      .use(checkAccess({ possibleScopes: ['instance.file:write'] }))
      .output(filePresenter)
      .do(async ctx => {
        let file = await fileService.deleteFile({
          file: ctx.file
        });

        return filePresenter.present({ file });
      })
  }
);
