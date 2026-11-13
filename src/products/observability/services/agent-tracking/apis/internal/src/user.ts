import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { mergeSuggestionPresenter } from './presenters/mergeSuggestion';
import { entityService, mergeSuggestionService } from '@mtsrc/agent-tracking-module-entities';
import { userErasureService } from '@mtsrc/agent-tracking-module-erasure';
import { organizationApp } from './_app';

let suggestionStatuses = ['open', 'accepted', 'dismissed'] as const;

export let userController = organizationApp.controller({
  erase: organizationApp
    .handler()
    .input(v.object({ organizationId: v.string(), userId: v.string() }))
    .do(async ctx => {
      let user = await entityService.getEntityById({
        organization: ctx.organization,
        entityId: ctx.input.userId
      });

      await userErasureService.eraseUser({ organization: ctx.organization, user });

      return { userId: user.id, erasing: true };
    }),

  mergeSuggestions: organizationApp.controller({
    list: organizationApp
      .handler()
      .input(
        Paginator.validate(
          v.object({
            organizationId: v.string(),

            statuses: v.optional(v.array(v.enumOf(suggestionStatuses))),
            entityId: v.optional(v.string())
          })
        )
      )
      .do(async ctx => {
        let paginator = await mergeSuggestionService.listMergeSuggestions({
          organization: ctx.organization,
          statuses: ctx.input.statuses,
          entityId: ctx.input.entityId
        });

        let list = await paginator.run(ctx.input);

        return Paginator.presentLight(list, mergeSuggestionPresenter);
      }),

    dismiss: organizationApp
      .handler()
      .input(
        v.object({
          organizationId: v.string(),
          mergeSuggestionId: v.string()
        })
      )
      .do(async ctx => {
        let mergeSuggestion = await mergeSuggestionService.getMergeSuggestionById({
          organization: ctx.organization,
          mergeSuggestionId: ctx.input.mergeSuggestionId
        });

        let dismissed = await mergeSuggestionService.dismissMergeSuggestion({
          mergeSuggestion
        });

        return mergeSuggestionPresenter(dismissed);
      })
  })
});
