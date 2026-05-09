import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { documentParticipantPresenter } from '../presenters';
import { documentParticipantService } from '../services';
import { app } from './_app';
import { storePermissionsSchema } from './document';
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
          documentId: v.string(),
          actorId: v.optional(v.string()),
          defaultPermissions: v.optional(storePermissionsSchema),
          overridePermissions: v.optional(v.boolean())
        })
      )
    )
    .do(async ctx => {
      let paginator = await documentParticipantService.listDocumentParticipants({
        tenant: ctx.tenant,
        environment: ctx.environment,
        documentId: ctx.input.documentId,
        actorId: ctx.input.actorId,
        defaultPermissions: ctx.input.defaultPermissions,
        overridePermissions: ctx.input.overridePermissions
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
        documentParticipantId: v.string(),
        actorId: v.optional(v.string()),
        defaultPermissions: v.optional(storePermissionsSchema),
        overridePermissions: v.optional(v.boolean())
      })
    )
    .do(async ctx =>
      documentParticipantPresenter(
        await documentParticipantService.getDocumentParticipantById({
          tenant: ctx.tenant,
          environment: ctx.environment,
          documentParticipantId: ctx.input.documentParticipantId,
          actorId: ctx.input.actorId,
          defaultPermissions: ctx.input.defaultPermissions,
          overridePermissions: ctx.input.overridePermissions
        })
      )
    )
});
