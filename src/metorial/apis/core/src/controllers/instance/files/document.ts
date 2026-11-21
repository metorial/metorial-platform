import { forbiddenError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import {
  documentEditTokenService,
  documentIdPattern,
  documentService
} from '@metorial/module-documents';
import { Controller } from '@metorial/rest';
import { getInstanceCargoAccess, getInstanceCargoActorInput } from '../../../lib/cargoAccess';
import { dateFilterValidator } from '../../../lib/dateFilter';
import { normalizeArrayParam } from '../../../lib/normalizeArrayParam';
import { checkAccess } from '../../../middleware/checkAccess';
import { instanceGroup, instancePath } from '../../../middleware/instanceGroup';
import {
  documentEditTokenPresenter,
  documentPermissionsPresenter,
  documentPresenter
} from '@metorial/presenters';
import { stringArrayFilterSchema } from './_listFilters';

export let documentGroup = instanceGroup.use(async ctx => {
  if (!ctx.params.documentId) {
    throw new Error('documentId is required');
  }

  let document = await documentService.getDocumentById({
    documentId: ctx.params.documentId,
    ...(await getInstanceCargoAccess(ctx))
  });

  return { document };
});

export let documentController = Controller.create(
  {
    name: 'Documents',
    description: 'A document is rich text with comments, versions, and participants.'
  },
  {
    list: instanceGroup
      .get(instancePath('documents', 'documents.list'), {
        name: 'List documents',
        description: 'Returns a paginated list of documents.',
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
            id: stringArrayFilterSchema('Only return documents with one of these IDs.'),
            file_id: stringArrayFilterSchema(
              'Only return documents stored in one of these files.'
            ),
            store_id: stringArrayFilterSchema('Only return documents in one of these stores.'),
            parent_document_id: stringArrayFilterSchema(
              'Only return documents cloned from one of these documents.'
            ),
            created_at: dateFilterValidator('document creation time'),
            updated_at: dateFilterValidator('document last update time')
          })
        )
      )
      .do(async ctx => {
        let paginator = await documentService.listDocuments({
          ...(await getInstanceCargoAccess(ctx)),
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
        description: 'Creates a document.',
        confidential: true
      })
      .use(
        checkAccess({
          possibleScopes: [
            'instance.file:read',
            'instance.file:write',
            'consumer#instance.document:read',
            'consumer#instance.document:write'
          ]
        })
      )
      .body(
        'default',
        v.object({
          title: v.string({ description: 'Title of the document.' }),
          content: v.string({ description: 'Content of the document.' })
        })
      )
      .output(documentPresenter)
      .do(async ctx => {
        let access = await getInstanceCargoAccess(ctx);
        let document = await documentService.createDocument({
          project: access.project,
          instance: access.instance,
          auditScope: access.auditScope,
          input: {
            title: ctx.body.title,
            content: ctx.body.content,
            authorization: access.authorization,
            defaultPermissions: access.defaultPermissions,
            overridePermissions: access.overridePermissions
          }
        });

        return documentPresenter.present({ document });
      }),

    get: documentGroup
      .get(instancePath('documents/:documentId', 'documents.get'), {
        name: 'Get document',
        description: 'Retrieves a document.',
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
        description: 'Returns what the caller can do with a document.'
      })
      .use(
        checkAccess({
          possibleScopes: ['instance.file:read', 'consumer#instance.document:read']
        })
      )
      .output(documentPermissionsPresenter)
      .do(async ctx => {
        let permissions = await documentService.getDocumentPermissions({
          document: ctx.document,
          ...(await getInstanceCargoAccess(ctx))
        });

        return documentPermissionsPresenter.present({ permissions });
      }),

    editToken: documentGroup
      .get(instancePath('documents/:documentId/edit-token', 'documents.editToken.get'), {
        name: 'Get document edit token',
        description:
          'Returns a short-lived read or write token for establishing a live document session. Requires write scopes, even when the issued token only grants read access.',
        confidential: true
      })
      .use(
        checkAccess({
          possibleScopes: ['instance.file:write', 'consumer#instance.document:write']
        })
      )
      .output(documentEditTokenPresenter)
      .do(async ctx => {
        let cargoAccess = await getInstanceCargoAccess(ctx);
        let permissions = await documentService.getDocumentPermissions({
          document: ctx.document,
          ...cargoAccess
        });

        let grantedPermissions = (
          permissions.hasFullAccess
            ? ['content_read', 'content_write']
            : permissions.permissions.filter(
                permission => permission == 'content_read' || permission == 'content_write'
              )
        ) as ('content_read' | 'content_write')[];
        if (!grantedPermissions.includes('content_read')) {
          throw new ServiceError(
            forbiddenError({
              message: 'You do not have permission to read this document'
            })
          );
        }

        let accessActor = getInstanceCargoActorInput(ctx);
        if (!accessActor) {
          throw new ServiceError(
            forbiddenError({ message: 'Document live access requires an actor' })
          );
        }

        let token = await documentEditTokenService.issueDocumentEditToken({
          documentId: ctx.document.id,
          instanceId: ctx.instance.id,
          organizationId: ctx.organization.id,
          accessTags: cargoAccess.accessTags,
          accessActor,
          permissions: grantedPermissions,
          defaultPermissions: cargoAccess.defaultPermissions,
          overridePermissions: cargoAccess.overridePermissions
        });

        return documentEditTokenPresenter.present({ token });
      }),

    update: documentGroup
      .patch(instancePath('documents/:documentId', 'documents.update'), {
        name: 'Update document',
        description: 'Updates a document.',
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
          title: v.optional(v.string({ description: 'Title of the document.' })),
          content: v.optional(v.string({ description: 'Content of the document.' }))
        })
      )
      .output(documentPresenter)
      .do(async ctx => {
        let access = await getInstanceCargoAccess(ctx);
        let document = await documentService.updateDocument({
          document: ctx.document,
          project: access.project,
          instance: access.instance,
          input: {
            title: ctx.body.title,
            content: ctx.body.content,
            authorization: access.authorization,
            defaultPermissions: access.defaultPermissions,
            overridePermissions: access.overridePermissions
          }
        });

        return documentPresenter.present({ document });
      }),

    delete: documentGroup
      .delete(instancePath('documents/:documentId', 'documents.delete'), {
        name: 'Delete document',
        description: 'Deletes a document.',
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
          ...(await getInstanceCargoAccess(ctx))
        });

        return documentPresenter.present({ document });
      }),

    clone: documentGroup
      .post(instancePath('documents/:documentId/clone', 'documents.clone'), {
        name: 'Clone document',
        description: 'Creates a copy of a document.',
        confidential: true
      })
      .use(checkAccess({ possibleScopes: ['instance.file:write'] }))
      .body(
        'default',
        v.object({
          target_document_id: v.optional(
            v.string({
              description: 'ID to use for the cloned document.',
              modifiers: [v.regex(documentIdPattern, { message: 'Invalid document ID' })]
            })
          ),
          title: v.optional(v.string({ description: 'Title of the cloned document.' }))
        })
      )
      .output(documentPresenter)
      .do(async ctx => {
        let access = await getInstanceCargoAccess(ctx);
        let document = await documentService.cloneDocument({
          document: ctx.document,
          project: access.project,
          instance: access.instance,
          auditScope: access.auditScope,
          input: {
            id: ctx.body.target_document_id,
            title: ctx.body.title,
            authorization: access.authorization,
            creatorActor: access.actor,
            defaultPermissions: access.defaultPermissions,
            overridePermissions: access.overridePermissions
          }
        });

        return documentPresenter.present({ document });
      })
  }
);
