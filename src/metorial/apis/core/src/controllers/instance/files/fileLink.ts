import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { fileLinkService, fileService } from '@metorial/module-file';
import { Controller } from '@metorial/rest';
import { getInstanceCargoAccess } from '../../../lib/cargoAccess';
import { checkAccess } from '../../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';
import { fileLinkPresenter } from '@metorial/presenters';

let fileLinkRootGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.linkId) throw new Error('linkId is required');

  let fileLink = await fileLinkService.getFileLinkById({
    fileLinkId: ctx.params.linkId,
    ...(await getInstanceCargoAccess(ctx))
  });

  return { fileLink };
});

export let fileLinkController = Controller.create(
  {
    name: 'File Links',
    description:
      'A file link is a public URL for a file. Anyone with the link can download the file without authenticating, until the link expires or is deleted.'
  },
  {
    listRoot: instanceGroup
      .get(instancePath('file-links', 'files.links.list'), {
        name: 'List file links',
        description: 'Returns a paginated list of file links.'
      })
      .use(
        checkAccess({
          possibleScopes: ['instance.file:read', 'instance.file_link:read']
        })
      )
      .outputList(fileLinkPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            file_id: v.optional(v.string(), {
              description: 'Only return links for this file.'
            })
          })
        )
      )
      .do(async ctx => {
        let paginator = await fileLinkService.listFileLinks({
          fileId: ctx.query.file_id ? [ctx.query.file_id] : undefined,
          ...(await getInstanceCargoAccess(ctx))
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, fileLink => fileLinkPresenter.present({ fileLink }));
      }),

    getRoot: fileLinkRootGroup
      .get(instancePath('file-links/:linkId', 'files.links.get'), {
        name: 'Get file link',
        description: 'Retrieves a file link.'
      })
      .use(
        checkAccess({
          possibleScopes: ['instance.file:read', 'instance.file_link:read']
        })
      )
      .output(fileLinkPresenter)
      .do(async ctx => {
        return fileLinkPresenter.present({ fileLink: ctx.fileLink });
      }),

    createRoot: instanceGroup
      .post(instancePath('file-links', 'files.links.create'), {
        name: 'Create file link',
        description: 'Creates a link for a file.'
      })
      .use(
        checkAccess({
          possibleScopes: [
            'instance.file:write',
            'instance.file_link:write',
            'consumer#instance.file_link:write'
          ]
        })
      )
      .body(
        'default',
        v.object({
          file_id: v.string({ description: 'File to share, by ID.' }),
          expires_at: v.optional(
            v.date({
              description: 'When the link stops working. The link never expires when omitted.'
            })
          )
        })
      )
      .output(fileLinkPresenter)
      .do(async ctx => {
        let file = await fileService.getFileById({
          fileId: ctx.body.file_id,
          ...(await getInstanceCargoAccess(ctx))
        });

        let access = await getInstanceCargoAccess(ctx);
        let fileLink = await fileLinkService.createFileLink({
          file,
          project: access.project,
          instance: access.instance,
          input: {
            expiresAt: ctx.body.expires_at,
            actor: access.actor
          }
        });

        return fileLinkPresenter.present({ fileLink });
      }),

    deleteRoot: fileLinkRootGroup
      .delete(instancePath('file-links/:linkId', 'files.links.delete'), {
        name: 'Delete file link',
        description: 'Deletes a file link. The file itself is kept.'
      })
      .use(
        checkAccess({
          possibleScopes: ['instance.file:write', 'instance.file_link:write']
        })
      )
      .output(fileLinkPresenter)
      .do(async ctx => {
        let fileLink = await fileLinkService.deleteFileLink({ fileLink: ctx.fileLink });

        return fileLinkPresenter.present({ fileLink });
      })
  }
);
