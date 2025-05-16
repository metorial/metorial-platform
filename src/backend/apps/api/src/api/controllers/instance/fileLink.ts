import { fileLinkService } from '@metorial/module-file';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { checkAccess } from '../../middleware/checkAccess';
import { instancePath } from '../../middleware/instanceGroup';
import { fileLinkPresenter, filePresenter } from '../../presenters';
import { fileGroup } from './file';

let fileLinkGroup = fileGroup.use(async ctx => {
  if (!ctx.params.linkId) throw new Error('linkId is required');

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
      .get(instancePath('files/:fileId/links', 'links.list'), {
        name: 'List file links',
        description: 'List all file links'
      })
      .use(checkAccess({ possibleScopes: ['instance.file:read', 'instance.file_link:read'] }))
      .outputList(filePresenter)
      .do(async ctx => {
        let paginator = await fileLinkService.listFileLinks({
          file: ctx.file
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, fileLink => fileLinkPresenter.present({ fileLink }));
      }),

    get: fileLinkGroup
      .get(instancePath('files/:fileId/links/:linkId', 'links.get'), {
        name: 'Get file link',
        description: 'Get the information of a specific file link'
      })
      .use(checkAccess({ possibleScopes: ['instance.file:read', 'instance.file_link:read'] }))
      .output(fileLinkPresenter)
      .do(async ctx => {
        return fileLinkPresenter.present({ fileLink: ctx.fileLink });
      }),

    create: fileGroup
      .post(instancePath('files/:fileId/links', 'links.create'), {
        name: 'Create file link',
        description: 'Create a new file link'
      })
      .use(
        checkAccess({ possibleScopes: ['instance.file:write', 'instance.file_link:write'] })
      )
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
      .patch(instancePath('files/:fileId/links/:linkId', 'links.update'), {
        name: 'Update file link',
        description: 'Update the information of a specific file link'
      })
      .use(
        checkAccess({ possibleScopes: ['instance.file:write', 'instance.file_link:write'] })
      )
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
      .delete(instancePath('files/:fileId/links/:linkId', 'links.delete'), {
        name: 'Delete file link',
        description: 'Delete a specific file link'
      })
      .use(
        checkAccess({ possibleScopes: ['instance.file:write', 'instance.file_link:write'] })
      )
      .output(fileLinkPresenter)
      .do(async ctx => {
        let fileLink = await fileLinkService.deleteFileLink({
          fileLink: ctx.fileLink
        });

        return fileLinkPresenter.present({ fileLink });
      })
  }
);
