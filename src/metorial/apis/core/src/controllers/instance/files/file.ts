import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { fileService } from '@metorial/module-file';
import { Controller } from '@metorial/rest';
import { getInstanceCargoAccess } from '../../../lib/cargoAccess';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';
import { filePresenter } from '@metorial/presenters';
import { stringArrayFilterSchema } from './_listFilters';

let purposeSlugs = [
  'user_image',
  'organization_image',
  'project_brand_image',
  'skill_image',
  'skill_export',
  'generic',
  'chat_message_attachment'
] as const;

export let fileGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.fileId) throw new Error('fileId is required');

  let file = await fileService.getFileById({
    fileId: ctx.params.fileId,
    ...(await getInstanceCargoAccess(ctx))
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
      .use(
        checkAccess({ possibleScopes: ['instance.file:read', 'consumer#instance.file:read'] })
      )
      .outputList(filePresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            id: stringArrayFilterSchema('Filter by file ID'),
            purpose: v.optional(
              v.union([v.enumOf(purposeSlugs as any), v.array(v.enumOf(purposeSlugs as any))]),
              {
                description: 'Filter by file purpose'
              }
            ),
            store_id: stringArrayFilterSchema('Filter by store ID'),
            document_id: stringArrayFilterSchema('Filter by document ID'),
            file_link_id: stringArrayFilterSchema('Filter by file link ID'),
            created_at: dateFilterValidator('Filter by creation time'),
            updated_at: dateFilterValidator('Filter by update time')
          })
        )
      )
      .do(async ctx => {
        let paginator = await fileService.listFiles({
          purpose: normalizeArrayParam(ctx.query.purpose) as any,
          ...(await getInstanceCargoAccess(ctx)),
          ids: normalizeArrayParam(ctx.query.id),
          storeIds: normalizeArrayParam(ctx.query.store_id),
          documentIds: normalizeArrayParam(ctx.query.document_id),
          fileLinkIds: normalizeArrayParam(ctx.query.file_link_id),
          createdAt: ctx.query.created_at,
          updatedAt: ctx.query.updated_at
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, file => filePresenter.present({ file }));
      }),

    get: fileGroup
      .get(instancePath('files/:fileId', 'files.get'), {
        name: 'Get file by ID',
        description: 'Retrieves details for a specific file by its ID.'
      })
      .use(
        checkAccess({ possibleScopes: ['instance.file:read', 'consumer#instance.file:read'] })
      )
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
        let file = await fileService.deleteFile({ file: ctx.file });

        return filePresenter.present({ file });
      })
  }
);
