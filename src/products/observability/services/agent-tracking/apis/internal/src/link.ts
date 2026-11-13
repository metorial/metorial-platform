import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { linkOrigins, linkReaches, linkTypes } from '@mtsrc/agent-tracking-module-entities';
import { linkPresenter } from './presenters/link';
import { entityService, linkService } from '@mtsrc/agent-tracking-module-entities';
import { organizationApp } from './_app';

let weightSchema = v.optional(
  v.nullable(v.number({ modifiers: [v.minValue(0), v.maxValue(1)] }))
);

let reachSchema = v.optional(v.enumOf(linkReaches));

export let linkController = organizationApp.controller({
  upsert: organizationApp
    .handler()
    .input(
      v.object({
        organizationId: v.string(),

        fromId: v.string(),
        toId: v.string(),
        type: v.enumOf(linkTypes),
        origin: v.optional(v.enumOf(linkOrigins)),
        weight: weightSchema,

        reach: reachSchema
      })
    )
    .do(async ctx => {
      let [from, to] = await Promise.all([
        entityService.getEntityById({
          organization: ctx.organization,
          entityId: ctx.input.fromId
        }),
        entityService.getEntityById({
          organization: ctx.organization,
          entityId: ctx.input.toId
        })
      ]);

      let link = await linkService.upsertLink({
        organization: ctx.organization,
        from,
        to,
        input: {
          type: ctx.input.type,
          origin: ctx.input.origin,
          weight: ctx.input.weight,
          reach: ctx.input.reach ?? 'from_now'
        }
      });

      return linkPresenter(link);
    }),

  replaceSet: organizationApp
    .handler()
    .input(
      v.object({
        organizationId: v.string(),

        toId: v.string(),
        type: v.enumOf(linkTypes),
        origin: v.optional(v.enumOf(linkOrigins)),
        from: v.array(v.object({ entityId: v.string(), weight: weightSchema })),

        reach: reachSchema
      })
    )
    .do(async ctx => {
      let to = await entityService.getEntityById({
        organization: ctx.organization,
        entityId: ctx.input.toId
      });
      let fromEntities = await entityService.getEntitiesByIds({
        organization: ctx.organization,
        entityIds: ctx.input.from.map(member => member.entityId)
      });

      let result = await linkService.replaceLinkSet({
        organization: ctx.organization,
        to,
        input: {
          type: ctx.input.type,
          origin: ctx.input.origin,
          reach: ctx.input.reach ?? 'from_now',
          members: ctx.input.from.map(member => ({
            entity: fromEntities.find(entity => entity.id == member.entityId)!,
            weight: member.weight
          }))
        }
      });

      return {
        object: 'agent_tracking#entity_link_set',
        added: result.added.map(linkPresenter),
        removed: result.removed.map(linkPresenter),
        changed: result.changed.map(linkPresenter),
        kept: result.kept.map(linkPresenter)
      };
    }),

  end: organizationApp
    .handler()
    .input(
      v.object({
        organizationId: v.string(),
        linkId: v.string(),
        reach: reachSchema
      })
    )
    .do(async ctx => {
      let link = await linkService.getLinkById({
        organization: ctx.organization,
        linkId: ctx.input.linkId
      });

      link = await linkService.endLink({
        organization: ctx.organization,
        link,
        reach: ctx.input.reach ?? 'from_now'
      });

      return linkPresenter(link);
    }),

  list: organizationApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          organizationId: v.string(),

          fromId: v.optional(v.string()),
          toId: v.optional(v.string()),
          types: v.optional(v.array(v.enumOf(linkTypes))),
          includeEnded: v.optional(v.boolean())
        })
      )
    )
    .do(async ctx => {
      let paginator = await linkService.listLinks({
        organization: ctx.organization,
        fromId: ctx.input.fromId,
        toId: ctx.input.toId,
        types: ctx.input.types,
        includeEnded: ctx.input.includeEnded
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, linkPresenter);
    })
});
