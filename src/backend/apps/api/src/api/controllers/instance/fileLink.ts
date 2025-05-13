import { fileLinkService } from '@metorial/module-file';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { fileLinkPresenter, filePresenter } from '../../presenters';
import { fileGroup, filePath } from './file';

let fileLinkGroup = fileGroup.use(async ctx => {
  let fileLink = await fileLinkService.getFileLinkById({
    fileLinkId: ctx.params.linkId,
    file: ctx.file
  });

  return { fileLink };
});

export let fileLinkController = Controller.create(
  {
    name: 'FileLink',
    description: 'Read and write file link information'
  },
  {
    list: fileGroup
      .get(filePath('/:fileId/links', 'links.list'), {
        name: 'List file links',
        description: 'List all file links'
      })
      .outputList(filePresenter)
      .do(async ctx => {
        let paginator = await fileLinkService.listFileLinks({
          file: ctx.file
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, fileLink => fileLinkPresenter.present({ fileLink }));
      }),

    get: fileLinkGroup
      .get(filePath('/:fileId/links/:linkId', 'links.get'), {
        name: 'Get file link',
        description: 'Get the information of a specific file link'
      })
      .output(fileLinkPresenter)
      .do(async ctx => {
        return fileLinkPresenter.present({ fileLink: ctx.fileLink });
      }),

    create: fileGroup
      .post(filePath('/:fileId/links', 'links.create'), {
        name: 'Create file link',
        description: 'Create a new file link'
      })
      .output(fileLinkPresenter)
      .body(
        'default',
        v.object({
          expires_at: v.optional(v.date())
        })
      )
      .do(async ctx => {
        let fileLink = await fileLinkService.createFileLink({
          file: ctx.file,
          input: {
            expiresAt: ctx.body.expires_at
          }
        });

        return fileLinkPresenter.present({ fileLink });
      }),

    update: fileLinkGroup
      .patch(filePath('/:fileId/links/:linkId', 'links.update'), {
        name: 'Update file link',
        description: 'Update the information of a specific file link'
      })
      .body(
        'default',
        v.object({
          expires_at: v.optional(v.date())
        })
      )
      .output(fileLinkPresenter)
      .do(async ctx => {
        let fileLink = await fileLinkService.updateFileLink({
          fileLink: ctx.fileLink,
          input: {
            expiresAt: ctx.body.expires_at
          }
        });

        return fileLinkPresenter.present({ fileLink });
      }),

    delete: fileLinkGroup
      .delete(filePath('/:fileId/links/:linkId', 'links.delete'), {
        name: 'Delete file link',
        description: 'Delete a specific file link'
      })
      .output(fileLinkPresenter)
      .do(async ctx => {
        let fileLink = await fileLinkService.deleteFileLink({
          fileLink: ctx.fileLink
        });

        return fileLinkPresenter.present({ fileLink });
      })
  }
);
