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
    name: 'File Links',
    description:
      'Files are private by default. If you want to share a file, you can create a link for it. Links are public and do not require authentication to access, so be careful with what you share.'
  },
  {
    list: fileGroup
      .get(instancePath('files/:fileId/links', 'links.list'), {
        name: 'List file links',
        description: 'Returns a list of links associated with a specific file.'
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
        name: 'Get file link by ID',
        description: 'Retrieves the details of a specific file link by its ID.'
      })
      .use(checkAccess({ possibleScopes: ['instance.file:read', 'instance.file_link:read'] }))
      .output(fileLinkPresenter)
      .do(async ctx => {
        return fileLinkPresenter.present({ fileLink: ctx.fileLink });
      }),

    create: fileGroup
      .post(instancePath('files/:fileId/links', 'links.create'), {
        name: 'Create file link',
        description: 'Creates a new link for a specific file.'
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
        name: 'Update file link by ID',
        description: 'Updates a file link’s properties, such as expiration.'
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
        name: 'Delete file link by ID',
        description: 'Deletes a specific file link by its ID.'
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
