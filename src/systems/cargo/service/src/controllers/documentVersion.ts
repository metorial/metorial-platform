import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { documentVersionPresenter } from '../presenters';
import { documentVersionService } from '../services';
import { app } from './_app';
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
          documentId: v.string()
        })
      )
    )
    .do(async ctx => {
      let paginator = await documentVersionService.listDocumentVersions({
        tenant: ctx.tenant,
        environment: ctx.environment,
        documentId: ctx.input.documentId
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
        documentVersionId: v.string()
      })
    )
    .do(async ctx => documentVersionPresenter(ctx.documentVersion))
});
