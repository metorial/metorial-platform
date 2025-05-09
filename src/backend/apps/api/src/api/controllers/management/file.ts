import { fileService, purposeSlugs } from '@metorial/module-file';
import { organizationService } from '@metorial/module-organization';
import { Paginator } from '@metorial/pagination';
import { Controller, Path } from '@metorial/rest';
import { v } from '@metorial/validation';
import { managementGroup } from '../../middleware/managementGroup';
import { filePresenter } from '../../presenters';

export let fileGroup = managementGroup.use(async ctx => {
  let file = await fileService.getFileById({
    fileId: ctx.params.fileId,
    owner:
      ctx.auth.type == 'machine'
        ? {
            type: 'organization',
            organization: ctx.auth.restrictions.organization
          }
        : {
            type: 'user',
            user: ctx.auth.user
          }
  });

  return { file };
});

export let fileController = Controller.create(
  {
    name: 'File',
    description: 'Read and write file information'
  },
  {
    list: managementGroup
      .get(Path('files', 'files.list'), {
        name: 'List  files',
        description: 'List all  files'
      })
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
      .get(Path('files/:fileId', 'files.get'), {
        name: 'Get file',
        description: 'Get the information of a specific file'
      })
      .output(filePresenter)
      .do(async ctx => {
        return filePresenter.present({ file: ctx.file });
      }),

    update: fileGroup
      .patch(Path('files/:fileId', 'files.update'), {
        name: 'Update file',
        description: 'Update the information of a specific file'
      })
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
      .delete(Path('files/:fileId', 'files.delete'), {
        name: 'Delete file',
        description: 'Delete a specific file'
      })
      .output(filePresenter)
      .do(async ctx => {
        let file = await fileService.deleteFile({
          file: ctx.file
        });

        return filePresenter.present({ file });
      })
  }
);
