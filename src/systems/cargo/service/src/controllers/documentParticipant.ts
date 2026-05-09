import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { documentParticipantPresenter } from '../presenters';
import { documentParticipantService } from '../services';
import { app } from './_app';
import { tenantApp } from './tenant';

export let documentParticipantApp = tenantApp.use(async ctx => {
  let documentParticipantId = ctx.body.documentParticipantId;
  if (!documentParticipantId) throw new Error('Document participant ID is required');

  let documentParticipant = await documentParticipantService.getDocumentParticipantById({
    tenant: ctx.tenant,
    environment: ctx.environment,
    documentParticipantId
  });

  return { documentParticipant };
});

export let documentParticipantController = app.controller({
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
      let paginator = await documentParticipantService.listDocumentParticipants({
        tenant: ctx.tenant,
        environment: ctx.environment,
        documentId: ctx.input.documentId
      });
      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, documentParticipantPresenter);
    }),

  get: documentParticipantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string(),
        documentParticipantId: v.string()
      })
    )
    .do(async ctx => documentParticipantPresenter(ctx.documentParticipant))
});
