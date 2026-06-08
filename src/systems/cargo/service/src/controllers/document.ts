import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { documentPermissionsPresenter, documentPresenter } from '../presenters';
import { documentService } from '@metorial-cargo/module-doc';
import { app } from './_app';
import { dateFilterSchema } from './_dateFilter';
import { tenantApp } from './tenant';

export let storePermissionsSchema = v.array(v.enumOf(['content_read', 'content_write']));
export let storeShortcutSchema = v.object({
  id: v.string(),
  path: v.string()
});

export let documentApp = tenantApp.use(async ctx => {
  let documentId = ctx.body.documentId;
  if (!documentId) throw new Error('Document ID is required');

  let document = await documentService.getDocumentById({
    tenant: ctx.tenant,
    environment: ctx.environment,
    documentId
  });

  return { document };
});

export let documentController = app.controller({
  create: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        documentId: v.optional(v.string()),
        title: v.string(),
        content: v.string(),
        actorId: v.optional(v.string()),
        store: v.optional(storeShortcutSchema),
        defaultPermissions: v.optional(storePermissionsSchema),
        overridePermissions: v.optional(v.boolean())
      })
    )
    .do(async ctx => {
      let document = await documentService.createDocument({
        tenant: ctx.tenant,
        environment: ctx.environment,
        input: {
          id: ctx.input.documentId,
          title: ctx.input.title,
          content: ctx.input.content,
          actorId: ctx.input.actorId,
          store: ctx.input.store,
          defaultPermissions: ctx.input.defaultPermissions,
          overridePermissions: ctx.input.overridePermissions
        }
      });

      return documentPresenter(document);
    }),

  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),
          documentIds: v.optional(v.array(v.string())),
          fileIds: v.optional(v.array(v.string())),
          storeIds: v.optional(v.array(v.string())),
          parentDocumentIds: v.optional(v.array(v.string())),
          createdByActorIds: v.optional(v.array(v.string())),
          createdAt: dateFilterSchema,
          updatedAt: dateFilterSchema,
          actorId: v.optional(v.string()),
          defaultPermissions: v.optional(storePermissionsSchema),
          overridePermissions: v.optional(v.boolean())
        })
      )
    )
    .do(async ctx => {
      let paginator = await documentService.listDocuments({
        tenant: ctx.tenant,
        environment: ctx.environment,
        ids: ctx.input.documentIds,
        fileIds: ctx.input.fileIds,
        storeIds: ctx.input.storeIds,
        parentDocumentIds: ctx.input.parentDocumentIds,
        createdByActorIds: ctx.input.createdByActorIds,
        createdAt: ctx.input.createdAt,
        updatedAt: ctx.input.updatedAt,
        actorId: ctx.input.actorId,
        defaultPermissions: ctx.input.defaultPermissions,
        overridePermissions: ctx.input.overridePermissions
      });
      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, documentPresenter);
    }),

  get: documentApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        documentId: v.string(),
        actorId: v.optional(v.string()),
        defaultPermissions: v.optional(storePermissionsSchema),
        overridePermissions: v.optional(v.boolean())
      })
    )
    .do(async ctx => {
      let document = await documentService.getDocumentById({
        tenant: ctx.tenant,
        environment: ctx.environment,
        documentId: ctx.document.id,
        actorId: ctx.input.actorId,
        defaultPermissions: ctx.input.defaultPermissions,
        overridePermissions: ctx.input.overridePermissions
      });

      return documentPresenter(document);
    }),

  getPermissions: documentApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        documentId: v.string(),
        actorId: v.optional(v.string()),
        defaultPermissions: v.optional(storePermissionsSchema),
        overridePermissions: v.optional(v.boolean())
      })
    )
    .do(async ctx =>
      documentPermissionsPresenter(
        await documentService.getDocumentPermissions({
          tenant: ctx.tenant,
          environment: ctx.environment,
          document: ctx.document,
          actorId: ctx.input.actorId,
          defaultPermissions: ctx.input.defaultPermissions,
          overridePermissions: ctx.input.overridePermissions
        })
      )
    ),

  update: documentApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        documentId: v.string(),
        title: v.optional(v.string()),
        content: v.optional(v.string()),
        actorId: v.optional(v.string()),
        defaultPermissions: v.optional(storePermissionsSchema),
        overridePermissions: v.optional(v.boolean())
      })
    )
    .do(async ctx => {
      let document = await documentService.updateDocument({
        tenant: ctx.tenant,
        environment: ctx.environment,
        document: ctx.document,
        input: {
          title: ctx.input.title,
          content: ctx.input.content,
          actorId: ctx.input.actorId,
          defaultPermissions: ctx.input.defaultPermissions,
          overridePermissions: ctx.input.overridePermissions
        }
      });

      return documentPresenter(document);
    }),

  delete: documentApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        documentId: v.string(),
        actorId: v.optional(v.string()),
        defaultPermissions: v.optional(storePermissionsSchema),
        overridePermissions: v.optional(v.boolean())
      })
    )
    .do(async ctx => {
      let document = await documentService.deleteDocument({
        tenant: ctx.tenant,
        environment: ctx.environment,
        document: ctx.document,
        actorId: ctx.input.actorId,
        defaultPermissions: ctx.input.defaultPermissions,
        overridePermissions: ctx.input.overridePermissions
      });

      return documentPresenter(document);
    }),

  clone: documentApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        documentId: v.string(),
        targetDocumentId: v.optional(v.string()),
        title: v.optional(v.string()),
        actorId: v.optional(v.string()),
        defaultPermissions: v.optional(storePermissionsSchema),
        overridePermissions: v.optional(v.boolean())
      })
    )
    .do(async ctx => {
      let document = await documentService.cloneDocument({
        tenant: ctx.tenant,
        environment: ctx.environment,
        document: ctx.document,
        input: {
          id: ctx.input.targetDocumentId,
          title: ctx.input.title,
          actorId: ctx.input.actorId,
          defaultPermissions: ctx.input.defaultPermissions,
          overridePermissions: ctx.input.overridePermissions
        }
      });

      return documentPresenter(document);
    })
});
