import { Paginator } from '@mtsrc/pagination';
import { v } from '@mtsrc/validation';
import { userPresenter, userTokenPresenter } from '../../presenters';
import { userService, userTokenService } from '../../services';
import { app } from './_app';
import { tenantApp } from './tenant';

export let userApp = tenantApp.use(async ctx => {
  let userId = ctx.body.userId;
  if (!userId) throw new Error('User ID is required');

  let user = await userService.getUserById({
    id: userId,
    tenant: ctx.tenant
  });

  return { user };
});

export let userController = app.controller({
  create: tenantApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),

        name: v.string(),
        identifier: v.string()
      })
    )
    .do(async ctx => {
      let user = await userService.createUser({
        tenant: ctx.tenant,
        input: {
          name: ctx.input.name,
          identifier: ctx.input.identifier
        }
      });
      return userPresenter(user);
    }),

  list: tenantApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          tenantId: v.string()
        })
      )
    )
    .do(async ctx => {
      let paginator = await userService.listUsers({
        tenant: ctx.tenant
      });

      let list = await paginator.run(ctx.input);

      return Paginator.presentLight(list, userPresenter);
    }),

  get: userApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        userId: v.string()
      })
    )
    .do(async ctx => userPresenter(ctx.user)),

  update: userApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        userId: v.string(),

        name: v.optional(v.string()),
        description: v.optional(v.string()),
        links: v.optional(v.array(v.object({ url: v.string(), label: v.string() })))
      })
    )
    .do(async ctx => {
      let user = await userService.updateUser({
        user: ctx.user,
        input: {
          name: ctx.input.name,
          description: ctx.input.description,
          links: ctx.input.links
        }
      });

      return userPresenter(user);
    }),

  token: app.controller({
    create: userApp
      .handler()
      .input(
        v.object({
          tenantId: v.string(),
          userId: v.string(),

          name: v.string()
        })
      )
      .do(async ctx => {
        let token = await userTokenService.createUserToken({
          user: ctx.user,
          input: {
            name: ctx.input.name
          }
        });

        return {
          ...userTokenPresenter(token),
          secret: token.secret
        };
      }),

    list: userApp
      .handler()
      .input(
        Paginator.validate(
          v.object({
            tenantId: v.string(),
            userId: v.string()
          })
        )
      )
      .do(async ctx => {
        let paginator = await userTokenService.listTokens({
          user: ctx.user
        });

        let list = await paginator.run(ctx.input);

        return Paginator.presentLight(list, userTokenPresenter);
      }),

    get: userApp
      .handler()
      .input(
        v.object({
          tenantId: v.string(),
          userId: v.string(),

          tokenId: v.string()
        })
      )
      .do(async ctx => {
        let token = await userTokenService.getTokenById({
          id: ctx.input.tokenId,
          user: ctx.user
        });

        return userTokenPresenter(token);
      }),

    delete: userApp
      .handler()
      .input(
        v.object({
          tenantId: v.string(),
          userId: v.string(),

          tokenId: v.string()
        })
      )
      .do(async ctx => {
        let token = await userTokenService.getTokenById({
          id: ctx.input.tokenId,
          user: ctx.user
        });

        token = await userTokenService.deleteUserToken({
          token
        });

        return userTokenPresenter(token);
      })
  })
});
