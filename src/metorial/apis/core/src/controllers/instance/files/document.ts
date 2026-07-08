import { forbiddenError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { documentEditTokenService, documentService } from '@metorial/module-file';
import { Controller } from '@metorial/rest';
import { getInstanceCargoAccess } from '../../../lib/cargoAccess';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';
import {
  documentEditTokenPresenter,
  documentPermissionsPresenter,
  documentPresenter
} from '../../../presenters';
import { stringArrayFilterSchema } from './_listFilters';

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
        description: 'Returns a paginated list of documents owned by the instance.',
        confidential: true
      })
      .use(
        checkAccess({
          possibleScopes: ['instance.file:read', 'consumer#instance.document:read']
        })
      )
      .outputList(documentPresenter)
      .query(
        'default',
        Paginator.validate(
          v.object({
            id: stringArrayFilterSchema('Filter by document ID'),
            file_id: stringArrayFilterSchema('Filter by file ID'),
            store_id: stringArrayFilterSchema('Filter by store ID'),
            parent_document_id: stringArrayFilterSchema('Filter by parent document ID'),
            created_at: dateFilterValidator('Filter by creation time'),
            updated_at: dateFilterValidator('Filter by update time')
          })
        )
      )
      .do(async ctx => {
        let paginator = await documentService.listDocuments({
          owner: {
            type: 'instance',
            instance: ctx.instance,
            organization: ctx.organization
          },
          ...getInstanceCargoAccess(ctx),
          ids: normalizeArrayParam(ctx.query.id),
          fileIds: normalizeArrayParam(ctx.query.file_id),
          storeIds: normalizeArrayParam(ctx.query.store_id),
          parentDocumentIds: normalizeArrayParam(ctx.query.parent_document_id),
          createdAt: ctx.query.created_at,
          updatedAt: ctx.query.updated_at
        });
        let list = await paginator.run(ctx.query);

        return Paginator.present(list, document => documentPresenter.present({ document }));
      }),

    create: instanceGroup
      .post(instancePath('documents', 'documents.create'), {
        name: 'Create document',
        description: 'Creates a new document for the instance.',
        confidential: true
      })
      .use(
        checkAccess({
          possibleScopes: ['instance.file:write', 'consumer#instance.document:write']
        })
      )
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
        description: 'Retrieves a document by its ID.',
        confidential: true
      })
      .use(
        checkAccess({
          possibleScopes: ['instance.file:read', 'consumer#instance.document:read']
        })
      )
      .output(documentPresenter)
      .do(async ctx => documentPresenter.present({ document: ctx.document })),

    permissions: documentGroup
      .get(instancePath('documents/:documentId/permissions', 'documents.permissions.get'), {
        name: 'Get document permissions',
        description:
          'Returns the effective Cargo permissions for the current actor on a specific document.'
      })
      .use(
        checkAccess({
          possibleScopes: ['instance.file:read', 'consumer#instance.document:read']
        })
      )
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

    editToken: documentGroup
      .get(instancePath('documents/:documentId/edit-token', 'documents.editToken.get'), {
        name: 'Get document edit token',
        description:
          'Returns a short-lived token for establishing a collaborative document editing session.',
        confidential: true
      })
      .use(
        checkAccess({
          possibleScopes: ['instance.file:write', 'consumer#instance.document:write']
        })
      )
      .output(documentEditTokenPresenter)
      .do(async ctx => {
        let cargoAccess = getInstanceCargoAccess(ctx);
        let permissions = await documentService.getDocumentPermissions({
          documentId: ctx.document.id,
          owner: {
            type: 'instance',
            instance: ctx.instance,
            organization: ctx.organization
          },
          ...cargoAccess
        });

        if (!permissions.hasFullAccess && !permissions.permissions.includes('content_write')) {
          throw new ServiceError(
            forbiddenError({
              message: 'You do not have permission to edit this document'
            })
          );
        }

        let token = await documentEditTokenService.issueDocumentEditToken({
          documentId: ctx.document.id,
          instanceId: ctx.instance.id,
          organizationId: ctx.organization.id,
          accessActor: cargoAccess.accessActor,
          defaultPermissions: cargoAccess.defaultPermissions,
          overridePermissions: cargoAccess.overridePermissions
        });

        return documentEditTokenPresenter.present({ token });
      }),

    update: documentGroup
      .patch(instancePath('documents/:documentId', 'documents.update'), {
        name: 'Update document by ID',
        description: 'Updates a specific document.',
        confidential: true
      })
      .use(
        checkAccess({
          possibleScopes: ['instance.file:write', 'consumer#instance.document:write']
        })
      )
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
        description: 'Deletes a specific document.',
        confidential: true
      })
      .use(
        checkAccess({
          possibleScopes: ['instance.file:write', 'consumer#instance.document:write']
        })
      )
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
        description: 'Clones a specific document.',
        confidential: true
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
