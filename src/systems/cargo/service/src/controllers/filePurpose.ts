import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { filePurposePresenter } from '../presenters';
import { filePurposeService } from '@metorial-cargo/module-file';
import { app } from './_app';

export let filePurposeApp = app.use(async ctx => {
  let filePurposeId = ctx.body.filePurposeId;
  if (!filePurposeId) throw new Error('File purpose ID is required');

  let filePurpose = await filePurposeService.getFilePurposeById({
    id: filePurposeId
  });

  return { filePurpose };
});

export let filePurposeController = app.controller({
  upsert: app
    .handler()
    .input(
      v.object({
        filePurposeId: v.optional(v.string()),
        slug: v.string(),
        name: v.string(),
        ownerType: v.enumOf(['user', 'organization', 'instance']),
        canHaveLinks: v.boolean()
      })
    )
    .do(async ctx => {
      let purpose = await filePurposeService.upsertFilePurpose({
        input: {
          id: ctx.input.filePurposeId,
          slug: ctx.input.slug,
          name: ctx.input.name,
          ownerType: ctx.input.ownerType,
          canHaveLinks: ctx.input.canHaveLinks
        }
      });

      return filePurposePresenter(purpose);
    }),

  list: app
    .handler()
    .input(Paginator.validate(v.object({})))
    .do(async ctx => {
      let paginator = await filePurposeService.listFilePurposes();

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, filePurposePresenter);
    }),

  get: filePurposeApp
    .handler()
    .input(
      v.object({
        filePurposeId: v.string()
      })
    )
    .do(async ctx => filePurposePresenter(ctx.filePurpose))
});
