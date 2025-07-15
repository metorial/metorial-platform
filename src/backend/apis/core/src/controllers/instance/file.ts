import { fileService, purposeSlugs } from '@metorial/module-file';
import { Paginator } from '@metorial/pagination';
import { Controller } from '@metorial/rest';
import { v } from '@metorial/validation';
import { checkAccess } from '../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { filePresenter } from '../../presenters';

export let fileGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.fileId) throw new Error('fileId is required');

  let file = await fileService.getFileById({
    fileId: ctx.params.fileId,
    owner: {
      type: 'instance',
      instance: ctx.instance,
      organization: ctx.organization
    }
  });

  return { file };
});

export let fileController = Controller.create(
  {
    name: 'Files',
    description:
      'Endpoints for listing, retrieving, updating, and deleting files associated with an instance.'
  },
  {
    list: instanceGroup
      .get(instancePath('files', 'files.list'), {
        name: 'List instance files',
        description: 'Returns a paginated list of files owned by the instance.'
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
          owner: {
            type: 'instance',
            instance: ctx.instance,
            organization: ctx.organization
          }
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, file => filePresenter.present({ file }));
      }),

    get: fileGroup
      .get(instancePath('files/:fileId', 'files.get'), {
        name: 'Get file by ID',
        description: 'Retrieves details for a specific file by its ID.'
      })
      .use(checkAccess({ possibleScopes: ['instance.file:read'] }))
      .output(filePresenter)
      .do(async ctx => {
        return filePresenter.present({ file: ctx.file });
      }),

    update: fileGroup
      .patch(instancePath('files/:fileId', 'files.update'), {
        name: 'Update file by ID',
        description: 'Updates editable fields of a specific file by its ID.'
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
      .delete(instancePath('files/:fileId', 'files.delete'), {
        name: 'Delete file by ID',
        description: 'Deletes a specific file by its ID.'
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
