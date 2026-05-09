import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { documentPresenter } from '../presenters';
import { documentService } from '../services';
import { app } from './_app';
import { tenantApp } from './tenant';

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
        actorId: v.optional(v.string())
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
          actorId: ctx.input.actorId
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
          environmentId: v.string()
        })
      )
    )
    .do(async ctx => {
      let paginator = await documentService.listDocuments({
        tenant: ctx.tenant,
        environment: ctx.environment
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
        actorId: v.optional(v.string())
      })
    )
    .do(async ctx => {
      let document = await documentService.getDocumentById({
        tenant: ctx.tenant,
        environment: ctx.environment,
        documentId: ctx.document.id,
        actorId: ctx.input.actorId
      });

      return documentPresenter(document);
    }),

  update: documentApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        documentId: v.string(),
        title: v.optional(v.string()),
        content: v.optional(v.string()),
        actorId: v.optional(v.string())
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
          actorId: ctx.input.actorId
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
        documentId: v.string()
      })
    )
    .do(async ctx => {
      let document = await documentService.deleteDocument({
        document: ctx.document
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
        title: v.optional(v.string())
      })
    )
    .do(async ctx => {
      let document = await documentService.cloneDocument({
        tenant: ctx.tenant,
        environment: ctx.environment,
        document: ctx.document,
        input: {
          id: ctx.input.targetDocumentId,
          title: ctx.input.title
        }
      });

      return documentPresenter(document);
    })
});
