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
  'chat_message_attachment',
  'sandbox_image_build_context'
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
      'A file is content uploaded to an instance, such as an image or an attachment. Its purpose controls what it can be linked to.'
  },
  {
    list: instanceGroup
      .get(instancePath('files', 'files.list'), {
        name: 'List files',
        description: 'Returns a paginated list of files.'
      })
      .use(
        checkAccess({ possibleScopes: ['instance.file:read', 'consumer#instance.file:read'] })
      )
      .outputList(filePresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            id: stringArrayFilterSchema('Only return files with one of these IDs.'),
            purpose: v.optional(
              v.union([v.enumOf(purposeSlugs as any), v.array(v.enumOf(purposeSlugs as any))]),
              {
                description: 'Only return files with one of these purposes.'
              }
            ),
            store_id: stringArrayFilterSchema('Only return files in one of these stores.'),
            document_id: stringArrayFilterSchema(
              'Only return files attached to one of these documents.'
            ),
            file_link_id: stringArrayFilterSchema(
              'Only return files shared through one of these file links.'
            ),
            created_at: dateFilterValidator('file creation time'),
            updated_at: dateFilterValidator('file last update time')
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
        name: 'Get file',
        description: 'Retrieves a file.'
      })
      .use(
        checkAccess({ possibleScopes: ['instance.file:read', 'consumer#instance.file:read'] })
      )
      .output(filePresenter)
      .do(async ctx => filePresenter.present({ file: ctx.file })),

    delete: fileGroup
      .delete(instancePath('files/:fileId', 'files.delete'), {
        name: 'Delete file',
        description: 'Deletes a file.'
      })
      .use(checkAccess({ possibleScopes: ['instance.file:write'] }))
      .output(filePresenter)
      .do(async ctx => {
        let file = await fileService.deleteFile({
          file: ctx.file,
          auditScope: ctx.auditScope
        });

        return filePresenter.present({ file });
      })
  }
);
