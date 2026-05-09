import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { documentVersionPresenter } from '../presenters';
import { documentVersionService } from '../services';
import { app } from './_app';
import { storePermissionsSchema } from './document';
import { tenantApp } from './tenant';

export let documentVersionApp = tenantApp.use(async ctx => {
  let documentVersionId = ctx.body.documentVersionId;
  if (!documentVersionId) throw new Error('Document version ID is required');

  let documentVersion = await documentVersionService.getDocumentVersionById({
    tenant: ctx.tenant,
    environment: ctx.environment,
    documentVersionId
  });

  return { documentVersion };
});

export let documentVersionController = app.controller({
  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string(),
          environmentId: v.string(),
          documentId: v.string(),
          actorId: v.optional(v.string()),
          defaultPermissions: v.optional(storePermissionsSchema),
          overridePermissions: v.optional(v.boolean())
        })
      )
    )
    .do(async ctx => {
      let paginator = await documentVersionService.listDocumentVersions({
        tenant: ctx.tenant,
        environment: ctx.environment,
        documentId: ctx.input.documentId,
        actorId: ctx.input.actorId,
        defaultPermissions: ctx.input.defaultPermissions,
        overridePermissions: ctx.input.overridePermissions
      });
      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, documentVersionPresenter);
    }),

  get: documentVersionApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        documentVersionId: v.string(),
        actorId: v.optional(v.string()),
        defaultPermissions: v.optional(storePermissionsSchema),
        overridePermissions: v.optional(v.boolean())
      })
    )
    .do(async ctx =>
      documentVersionPresenter(
        await documentVersionService.getDocumentVersionById({
          tenant: ctx.tenant,
          environment: ctx.environment,
          documentVersionId: ctx.input.documentVersionId,
          actorId: ctx.input.actorId,
          defaultPermissions: ctx.input.defaultPermissions,
          overridePermissions: ctx.input.overridePermissions
        })
      )
    )
});
