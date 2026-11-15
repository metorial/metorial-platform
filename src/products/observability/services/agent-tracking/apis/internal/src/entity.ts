import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { entityPresenter } from './presenters/entity';
import { entityService } from '@mtsrc/agent-tracking-module-entities';
import { organizationApp } from './_app';

let identifierSchema = v.object({ type: v.string(), value: v.string() });

let scopeSchema = v.object({
  projectId: v.optional(v.string()),
  instanceId: v.optional(v.string())
});

let statuses = ['managed', 'discovered', 'merged', 'archived'] as const;

export let entityController = organizationApp.controller({
  upsert: organizationApp
    .handler()
    .input(
      v.object({
        organizationId: v.string(),

        kind: v.string(),
        source: v.optional(v.string()),
        ref: v.optional(v.string()),

        slug: v.optional(v.nullable(v.string())),
        name: v.optional(v.nullable(v.string())),
        attributes: v.optional(v.record(v.any())),

        scope: v.optional(v.nullable(scopeSchema)),
        identifiers: v.optional(v.array(identifierSchema))
      })
    )
    .do(async ctx => {
      let entity = await entityService.upsertEntity({
        organization: ctx.organization,
        input: {
          kind: ctx.input.kind,
          source: ctx.input.source,
          ref: ctx.input.ref,
          slug: ctx.input.slug,
          name: ctx.input.name,
          attributes: ctx.input.attributes,
          scope: ctx.input.scope,
          identifiers: ctx.input.identifiers
        }
      });

      return entityPresenter(entity);
    }),

  get: organizationApp
    .handler()
    .input(
      v.object({
        organizationId: v.string(),
        entityId: v.string()
      })
    )
    .do(async ctx => {
      let entity = await entityService.getEntityById({
        organization: ctx.organization,
        entityId: ctx.input.entityId
      });

      return entityPresenter(entity);
    }),

  getByRef: organizationApp
    .handler()
    .input(
      v.object({
        organizationId: v.string(),
        kind: v.string(),
        source: v.string(),
        ref: v.string()
      })
    )
    .do(async ctx => {
      let entity = await entityService.getEntityByRef({
        organization: ctx.organization,
        kind: ctx.input.kind,
        source: ctx.input.source,
        ref: ctx.input.ref
      });

      return entityPresenter(entity);
    }),

  list: organizationApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          organizationId: v.string(),

          kinds: v.optional(v.array(v.string())),
          statuses: v.optional(v.array(v.enumOf(statuses))),
          scope: v.optional(scopeSchema),
          search: v.optional(v.string()),
          needsReview: v.optional(v.boolean())
        })
      )
    )
    .do(async ctx => {
      let paginator = await entityService.listEntities({
        organization: ctx.organization,
        kinds: ctx.input.kinds,
        statuses: ctx.input.statuses,
        scope: ctx.input.scope,
        search: ctx.input.search,
        needsReview: ctx.input.needsReview
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, entityPresenter);
    }),

  archive: organizationApp
    .handler()
    .input(
      v.object({
        organizationId: v.string(),
        entityId: v.string()
      })
    )
    .do(async ctx => {
      let entity = await entityService.getEntityById({
        organization: ctx.organization,
        entityId: ctx.input.entityId
      });

      entity = await entityService.archiveEntity({ organization: ctx.organization, entity });

      return entityPresenter(entity);
    }),

  merge: organizationApp
    .handler()
    .input(
      v.object({
        organizationId: v.string(),
        winnerId: v.string(),
        loserId: v.string()
      })
    )
    .do(async ctx => {
      let winner = await entityService.getEntityById({
        organization: ctx.organization,
        entityId: ctx.input.winnerId
      });
      let loser = await entityService.getEntityById({
        organization: ctx.organization,
        entityId: ctx.input.loserId
      });

      let entity = await entityService.mergeEntities({
        organization: ctx.organization,
        winner,
        loser
      });

      return entityPresenter(entity);
    }),

  identifiers: organizationApp.controller({
    set: organizationApp
      .handler()
      .input(
        v.object({
          organizationId: v.string(),
          entityId: v.string(),

          types: v.optional(v.array(v.string())),
          identifiers: v.array(identifierSchema)
        })
      )
      .do(async ctx => {
        let entity = await entityService.getEntityById({
          organization: ctx.organization,
          entityId: ctx.input.entityId
        });

        entity = await entityService.setIdentifiers({
          organization: ctx.organization,
          entity,
          types: ctx.input.types,
          identifiers: ctx.input.identifiers
        });

        return entityPresenter(entity);
      })
  })
});
