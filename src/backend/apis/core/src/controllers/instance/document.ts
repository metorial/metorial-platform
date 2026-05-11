import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { documentService } from '@metorial/module-file';
import { Controller } from '@metorial/rest';
import { getInstanceCargoAccess } from '../../lib/cargoAccess';
import { checkAccess } from '../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../middleware/instanceGroup';
import { documentPermissionsPresenter, documentPresenter } from '../../presenters';

export let documentGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.documentId) {
    throw new Error('documentId is required');
  }

  let document = await documentService.getDocumentById({
    documentId: ctx.params.documentId,
    owner: {
      type: 'instance',
      instance: ctx.instance,
      organization: ctx.organization
    },
    ...getInstanceCargoAccess(ctx)
  });

  return { document };
});

export let documentController = Controller.create(
  {
    name: 'Documents',
    description: 'Create and manage instance documents backed by Cargo.'
  },
  {
    list: instanceGroup
      .get(instancePath('documents', 'documents.list'), {
        name: 'List documents',
        description: 'Returns a paginated list of documents owned by the instance.'
      })
      .use(checkAccess({ possibleScopes: ['instance.file:read'] }))
      .outputList(documentPresenter)
      .query('default', Paginator.validate(v.object({})))
      .do(async ctx => {
        let paginator = await documentService.listDocuments({
          owner: {
            type: 'instance',
            instance: ctx.instance,
            organization: ctx.organization
          },
          ...getInstanceCargoAccess(ctx)
        });
        let list = await paginator.run(ctx.query);

        return Paginator.present(list, document => documentPresenter.present({ document }));
      }),

    create: instanceGroup
      .post(instancePath('documents', 'documents.create'), {
        name: 'Create document',
        description: 'Creates a new document for the instance.'
      })
      .use(checkAccess({ possibleScopes: ['instance.file:write'] }))
      .body(
        'default',
        v.object({
          title: v.string(),
          content: v.string()
        })
      )
      .output(documentPresenter)
      .do(async ctx => {
        let document = await documentService.createDocument({
          owner: {
            type: 'instance',
            instance: ctx.instance,
            organization: ctx.organization
          },
          ...getInstanceCargoAccess(ctx),
          input: {
            title: ctx.body.title,
            content: ctx.body.content
          }
        });

        return documentPresenter.present({ document });
      }),

    get: documentGroup
      .get(instancePath('documents/:documentId', 'documents.get'), {
        name: 'Get document by ID',
        description: 'Retrieves a document by its ID.'
      })
      .use(checkAccess({ possibleScopes: ['instance.file:read'] }))
      .output(documentPresenter)
      .do(async ctx => documentPresenter.present({ document: ctx.document })),

    permissions: documentGroup
      .get(instancePath('documents/:documentId/permissions', 'documents.permissions.get'), {
        name: 'Get document permissions',
        description:
          'Returns the effective Cargo permissions for the current actor on a specific document.'
      })
      .use(checkAccess({ possibleScopes: ['instance.file:read'] }))
      .output(documentPermissionsPresenter)
      .do(async ctx => {
        let permissions = await documentService.getDocumentPermissions({
          documentId: ctx.document.id,
          owner: {
            type: 'instance',
            instance: ctx.instance,
            organization: ctx.organization
          },
          ...getInstanceCargoAccess(ctx)
        });

        return documentPermissionsPresenter.present({ permissions });
      }),

    update: documentGroup
      .patch(instancePath('documents/:documentId', 'documents.update'), {
        name: 'Update document by ID',
        description: 'Updates a specific document.'
      })
      .use(checkAccess({ possibleScopes: ['instance.file:write'] }))
      .body(
        'default',
        v.object({
          title: v.optional(v.string()),
          content: v.optional(v.string())
        })
      )
      .output(documentPresenter)
      .do(async ctx => {
        let document = await documentService.updateDocument({
          document: ctx.document,
          owner: {
            type: 'instance',
            instance: ctx.instance,
            organization: ctx.organization
          },
          ...getInstanceCargoAccess(ctx),
          input: {
            title: ctx.body.title,
            content: ctx.body.content
          }
        });

        return documentPresenter.present({ document });
      }),

    delete: documentGroup
      .delete(instancePath('documents/:documentId', 'documents.delete'), {
        name: 'Delete document by ID',
        description: 'Deletes a specific document.'
      })
      .use(checkAccess({ possibleScopes: ['instance.file:write'] }))
      .output(documentPresenter)
      .do(async ctx => {
        let document = await documentService.deleteDocument({
          document: ctx.document,
          owner: {
            type: 'instance',
            instance: ctx.instance,
            organization: ctx.organization
          },
          ...getInstanceCargoAccess(ctx)
        });

        return documentPresenter.present({ document });
      }),

    clone: documentGroup
      .post(instancePath('documents/:documentId/clone', 'documents.clone'), {
        name: 'Clone document by ID',
        description: 'Clones a specific document.'
      })
      .use(checkAccess({ possibleScopes: ['instance.file:write'] }))
      .body(
        'default',
        v.object({
          target_document_id: v.optional(v.string()),
          title: v.optional(v.string())
        })
      )
      .output(documentPresenter)
      .do(async ctx => {
        let document = await documentService.cloneDocument({
          document: ctx.document,
          owner: {
            type: 'instance',
            instance: ctx.instance,
            organization: ctx.organization
          },
          ...getInstanceCargoAccess(ctx),
          input: {
            id: ctx.body.target_document_id,
            title: ctx.body.title
          }
        });

        return documentPresenter.present({ document });
      })
  }
);
