import { badRequestError, ServiceError } from '@mtsrc/error';
import { v } from '@mtsrc/validation';
import { userService } from '@metorial/module-user';
import { Controller, Path } from '@metorial/rest';
import { checkAccess } from '../../middleware/checkAccess';
import { userGroup, userOrConsumerGroup } from '../../middleware/userGroup';
import { userPresenter } from '../../presenters';

export let dashboardUserController = Controller.create(
  {
    name: 'User',
    description: 'Read and write user information'
  },
  {
    get: userOrConsumerGroup
      .get(Path('/user', 'management.user.get'), {
        name: 'Get user',
        description: 'Get the current user information'
      })
      .use(checkAccess({ possibleScopes: ['user:read', 'consumer#instance.profile:read'] }))
      .output(userPresenter)
      .do(async ctx => {
        if (ctx.consumerProfile) {
          let [firstName, ...rest] = ctx.consumerProfile.name.split(' ');
          let lastName = rest.join(' ');

          return userPresenter.present({
            user: {
              id: ctx.consumerProfile.id,
              status: 'active',
              type: 'consumer',
              email: ctx.consumerProfile.email,
              name: ctx.consumerProfile.name,
              firstName: firstName,
              lastName: lastName,
              image: { type: 'default' },
              createdAt: ctx.consumerProfile.createdAt,
              updatedAt: ctx.consumerProfile.updatedAt
            }
          });
        }

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
        if (ctx.auth.type != 'user' || ctx.auth.machineAccess) {
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
