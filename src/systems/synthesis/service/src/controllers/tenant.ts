import { notFoundError, ServiceError } from '@mtsrc/error';
import { Paginator } from '@mtsrc/pagination';
import { v } from '@mtsrc/validation';
import { db } from '../db';
import { getId } from '../id';
import { actorPresenter, environmentPresenter, tenantPresenter } from '../presenters';
import { app } from './_app';

export let tenantWithoutEnvironmentApp = app.use(async ctx => {
  let tenantId = ctx.body.tenantId;
  if (!tenantId) throw new Error('Tenant ID is required');

  let tenant = await db.tenant.findFirst({
    where: {
      id: tenantId
    }
  });
  if (!tenant) {
    throw new ServiceError(notFoundError('tenant', tenantId));
  }

  return { tenant };
});

export let tenantApp = tenantWithoutEnvironmentApp.use(async ctx => {
  let environmentId = ctx.body.environmentId;
  if (!environmentId) throw new Error('Environment ID is required');

  let environment = await db.environment.findFirst({
    where: {
      tenantOid: ctx.tenant.oid,
      id: environmentId
    }
  });
  if (!environment) {
    throw new ServiceError(notFoundError('environment', environmentId));
  }

  return { environment };
});

export let tenantActorOptionalApp = tenantApp.use(async ctx => {
  let actorId = ctx.body.actorId;
  if (!actorId) return { actor: null };

  let actor = await db.tenantActor.findFirst({
    where: {
      tenantOid: ctx.tenant.oid,
      id: actorId
    }
  });
  if (!actor) {
    throw new ServiceError(notFoundError('tenant_actor', actorId));
  }

  return { actor };
});

export let tenantActorApp = tenantActorOptionalApp.use(async ctx => {
  if (!ctx.actor) throw new Error('Actor ID is required');
  return { actor: ctx.actor };
});

export let tenantController = app.controller({
  upsert: app
    .handler()
    .input(
      v.object({
        name: v.string(),
        identifier: v.string()
      })
    )
    .do(async ctx => {
      let tenant = await db.tenant.upsert({
        where: {
          identifier: ctx.input.identifier
        },
        update: {
          name: ctx.input.name
        },
        create: {
          ...getId('tenant'),
          name: ctx.input.name,
          identifier: ctx.input.identifier
        }
      });

      return tenantPresenter(tenant);
    }),

  get: tenantWithoutEnvironmentApp
    .handler()
    .input(
      v.object({
        tenantId: v.string()
      })
    )
    .do(async ctx => {
      let environments = await db.environment.findMany({
        where: {
          tenantOid: ctx.tenant.oid
        },
        orderBy: {
          createdAt: 'asc'
        }
      });
      let actors = await db.tenantActor.findMany({
        where: {
          tenantOid: ctx.tenant.oid
        },
        orderBy: {
          createdAt: 'asc'
        }
      });

      return {
        ...tenantPresenter(ctx.tenant),
        environments: environments.map(environmentPresenter),
        actors: actors.map(actorPresenter)
      };
    })
});

export let environmentController = app.controller({
  upsert: tenantWithoutEnvironmentApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.optional(v.string()),
        identifier: v.string(),
        name: v.string(),
        type: v.enumOf(['development', 'production'])
      })
    )
    .do(async ctx => {
      let environment = await db.environment.upsert({
        where: ctx.input.environmentId
          ? {
              id: ctx.input.environmentId
            }
          : {
              tenantOid_identifier: {
                tenantOid: ctx.tenant.oid,
                identifier: ctx.input.identifier
              }
            },
        update: {
          identifier: ctx.input.identifier,
          name: ctx.input.name,
          type: ctx.input.type
        },
        create: {
          ...getId('environment'),
          tenantOid: ctx.tenant.oid,
          identifier: ctx.input.identifier,
          name: ctx.input.name,
          type: ctx.input.type
        }
      });

      return environmentPresenter(environment);
    }),

  list: tenantWithoutEnvironmentApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string()
        })
      )
    )
    .do(async ctx => {
      let paginator = Paginator.create(({ prisma }) =>
        prisma(async opts =>
          await db.environment.findMany({
            ...opts,
            where: {
              tenantOid: ctx.tenant.oid
            }
          })
        )
      );
      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, environmentPresenter);
    }),

  get: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        environmentId: v.string()
      })
    )
    .do(async ctx => environmentPresenter(ctx.environment))
});

export let actorController = app.controller({
  upsert: tenantWithoutEnvironmentApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        actorId: v.optional(v.string()),
        identifier: v.string(),
        name: v.string(),
        type: v.enumOf(['external', 'system']),
        organizationActorId: v.optional(v.string()),
        consumerId: v.optional(v.string())
      })
    )
    .do(async ctx => {
      let actor = await db.tenantActor.upsert({
        where: ctx.input.actorId
          ? {
              id: ctx.input.actorId
            }
          : {
              tenantOid_identifier: {
                tenantOid: ctx.tenant.oid,
                identifier: ctx.input.identifier
              }
            },
        update: {
          identifier: ctx.input.identifier,
          name: ctx.input.name,
          type: ctx.input.type,
          organizationActorId: ctx.input.organizationActorId,
          consumerId: ctx.input.consumerId
        },
        create: {
          ...getId('tenantActor'),
          tenantOid: ctx.tenant.oid,
          identifier: ctx.input.identifier,
          name: ctx.input.name,
          type: ctx.input.type,
          organizationActorId: ctx.input.organizationActorId,
          consumerId: ctx.input.consumerId
        }
      });

      return actorPresenter(actor);
    }),

  list: tenantWithoutEnvironmentApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string()
        })
      )
    )
    .do(async ctx => {
      let paginator = Paginator.create(({ prisma }) =>
        prisma(async opts =>
          await db.tenantActor.findMany({
            ...opts,
            where: {
              tenantOid: ctx.tenant.oid
            }
          })
        )
      );
      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, actorPresenter);
    }),

  get: tenantWithoutEnvironmentApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        actorId: v.string()
      })
    )
    .do(async ctx => {
      let actor = await db.tenantActor.findFirst({
        where: {
          tenantOid: ctx.tenant.oid,
          id: ctx.input.actorId
        }
      });
      if (!actor) {
        throw new ServiceError(notFoundError('tenant_actor', ctx.input.actorId));
      }

      return actorPresenter(actor);
    })
});
