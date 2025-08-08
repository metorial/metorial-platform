import { badRequestError, ServiceError } from '@metorial/error';
import { userService } from '@metorial/module-user';
import { Controller, Path } from '@metorial/rest';
import { v } from '@metorial/validation';
import { checkAccess } from '../../middleware/checkAccess';
import { userGroup } from '../../middleware/userGroup';
import { userPresenter } from '../../presenters';

export let dashboardUserController = Controller.create(
  {
    name: 'User',
    description: 'Read and write user information'
  },
  {
    get: userGroup
      .get(Path('/user', 'management.user.get'), {
        name: 'Get user',
        description: 'Get the current user information'
      })
      .use(checkAccess({ possibleScopes: ['user:read'] }))
      .output(userPresenter)
      .do(async ctx => {
        return userPresenter.present({ user: ctx.user });
      }),

    update: userGroup
      .post(Path('/user', 'management.user.update'), {
        name: 'Update user',
        description: 'Update the current user information'
      })
      .use(checkAccess({ possibleScopes: ['user:write'] }))
      .body(
        'default',
        v.object({
          name: v.optional(v.string()),
          email: v.optional(v.string())
        })
      )
      .output(userPresenter)
      .do(async ctx => {
        let user = await userService.updateUser({
          user: ctx.user,
          input: {
            name: ctx.body.name,
            email: ctx.body.email
          },
          context: ctx.context
        });

        return userPresenter.present({ user });
      }),

    delete: userGroup
      .post(Path('/user', 'management.user.delete'), {
        name: 'Update user',
        description: 'Update the current user information'
      })
      .use(checkAccess({ possibleScopes: ['user:write'] }))
      .body(
        'default',
        v.object({
          name: v.optional(v.string()),
          email: v.optional(v.string())
        })
      )
      .output(userPresenter)
      .do(async ctx => {
        if (ctx.auth.machineAccess) {
          throw new ServiceError(
            badRequestError({
              message: 'Cannot delete user using API'
            })
          );
        }

        let user = await userService.deleteUser({
          user: ctx.user,
          context: ctx.context
        });

        return userPresenter.present({ user });
      })
  }
);
