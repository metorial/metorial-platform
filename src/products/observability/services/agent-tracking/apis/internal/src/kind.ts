import { v } from '@lowerdeck/validation';
import { entityKindPresenter } from './presenters/entityKind';
import { entityKindService } from '@mtsrc/agent-tracking-module-entities';
import { organizationApp } from './_app';

let tagOrigins = ['source', 'repo', 'environment'] as const;

export let kindController = organizationApp.controller({
  upsert: organizationApp
    .handler()
    .input(
      v.object({
        organizationId: v.string(),

        key: v.string(),
        name: v.optional(v.string()),
        cardinality: v.optional(v.enumOf(['single', 'multi'])),

        attributes: v.optional(
          v.object({
            description: v.optional(v.nullable(v.string())),
            tagOrigins: v.optional(v.array(v.enumOf(tagOrigins))),
            queryableAttributes: v.optional(
              v.array(v.string({ modifiers: [v.minLength(1), v.maxLength(64)] }), {
                modifiers: [v.maxLength(20)]
              })
            )
          })
        )
      })
    )
    .do(async ctx => {
      let kind = await entityKindService.upsertKind({
        organization: ctx.organization,
        input: {
          key: ctx.input.key,
          name: ctx.input.name,
          cardinality: ctx.input.cardinality,
          attributes: ctx.input.attributes
        }
      });

      return entityKindPresenter(kind);
    }),

  list: organizationApp
    .handler()
    .input(v.object({ organizationId: v.string() }))
    .do(async ctx => {
      let kinds = await entityKindService.listKinds({ organization: ctx.organization });

      return { object: 'list', items: kinds.map(entityKindPresenter) };
    })
});
