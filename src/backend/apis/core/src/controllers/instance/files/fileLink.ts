import { Paginator } from '@mtsrc/pagination';
import { v } from '@mtsrc/validation';
import { fileLinkService, fileService } from '@metorial/module-file';
import { Controller } from '@metorial/rest';
import { getInstanceCargoAccess, hasInstanceConsumerAccess } from '../../../lib/cargoAccess';
import { checkAccess } from '../../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';
import { fileLinkPresenter } from '../../../presenters';

let fileLinkRootGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.linkId) throw new Error('linkId is required');

  let fileLink = await fileLinkService.getFileLinkById({
    fileLinkId: ctx.params.linkId,
    owner: {
      type: 'instance',
      organization: ctx.organization,
      instance: ctx.instance
    },
    ...(hasInstanceConsumerAccess(ctx) ? getInstanceCargoAccess(ctx) : {})
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
    listRoot: instanceGroup
      .get(instancePath('file-links', 'files.links.list'), {
        name: 'List file links',
        description:
          'Returns a paginated list of file links owned by the instance organization.'
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
              description: 'Filter by file ID'
            })
          })
        )
      )
      .do(async ctx => {
        let paginator = await fileLinkService.listFileLinks({
          owner: {
            type: 'instance',
            organization: ctx.organization,
            instance: ctx.instance
          },
          fileId: ctx.query.file_id,
          ...(hasInstanceConsumerAccess(ctx) ? getInstanceCargoAccess(ctx) : {})
        });

        let list = await paginator.run(ctx.query);

        return Paginator.present(list, fileLink => fileLinkPresenter.present({ fileLink }));
      }),

    getRoot: fileLinkRootGroup
      .get(instancePath('file-links/:linkId', 'files.links.get'), {
        name: 'Get file link by ID',
        description: 'Retrieves the details of a specific file link by its ID.'
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
        description: 'Creates a new link for a specific file.'
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
          file_id: v.string(),
          expires_at: v.optional(v.date())
        })
      )
      .output(fileLinkPresenter)
      .do(async ctx => {
        let file = await fileService.getFileById({
          fileId: ctx.body.file_id,
          owner: {
            type: 'instance',
            instance: ctx.instance,
            organization: ctx.organization
          },
          ...(hasInstanceConsumerAccess(ctx) ? getInstanceCargoAccess(ctx) : {})
        });

        let fileLink = await fileLinkService.createFileLink({
          file,
          owner: {
            type: 'instance',
            instance: ctx.instance,
            organization: ctx.organization
          },
          ...(hasInstanceConsumerAccess(ctx) ? getInstanceCargoAccess(ctx) : {}),
          input: {
            expiresAt: ctx.body.expires_at
          }
        });

        return fileLinkPresenter.present({ fileLink });
      }),

    deleteRoot: fileLinkRootGroup
      .delete(instancePath('file-links/:linkId', 'files.links.delete'), {
        name: 'Delete file link by ID',
        description: 'Deletes a specific file link by its ID.'
      })
      .use(
        checkAccess({
          possibleScopes: ['instance.file:write', 'instance.file_link:write']
        })
      )
      .output(fileLinkPresenter)
      .do(async ctx => {
        let fileLink = await fileLinkService.deleteFileLink({
          fileLink: ctx.fileLink,
          owner: {
            type: 'instance',
            instance: ctx.instance,
            organization: ctx.organization
          },
          ...(hasInstanceConsumerAccess(ctx) ? getInstanceCargoAccess(ctx) : {})
        });

        return fileLinkPresenter.present({ fileLink });
      })
  }
);
