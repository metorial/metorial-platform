import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { fileService, purposeSlugs } from '@metorial/module-file';
import { Controller } from '@metorial/rest';
import { getInstanceCargoAccess } from '../../lib/cargoAccess';
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
    },
    ...getInstanceCargoAccess(ctx)
  });

  return { file };
});

export let fileController = Controller.create(
  {
    name: 'Files',
    description:
      'Represents files that you have uploaded to Metorial. Files can be linked to various resources based on their purpose. Metorial can also automatically extract files for you, for example for data exports.'
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
            purpose: v.optional(v.enumOf(purposeSlugs as any), {
              description: 'Filter by file purpose'
            })
          })
        )
      )
      .do(async ctx => {
        let paginator = await fileService.listFiles({
          owner: {
            type: 'instance',
            instance: ctx.instance,
            organization: ctx.organization
          },
          ...getInstanceCargoAccess(ctx)
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
      .do(async ctx => filePresenter.present({ file: ctx.file })),

    delete: fileGroup
      .delete(instancePath('files/:fileId', 'files.delete'), {
        name: 'Delete file by ID',
        description: 'Deletes a specific file by its ID.'
      })
      .use(checkAccess({ possibleScopes: ['instance.file:write'] }))
      .output(filePresenter)
      .do(async ctx => {
        let file = await fileService.deleteFile({
          file: ctx.file,
          owner: {
            type: 'instance',
            instance: ctx.instance,
            organization: ctx.organization
          },
          ...getInstanceCargoAccess(ctx)
        });

        return filePresenter.present({ file });
      })
  }
);
