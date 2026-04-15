import { Paginator } from '@lowerdeck/pagination';
import { v } from '@lowerdeck/validation';
import { adminService } from '../../../services/admin';
import { userService } from '../../../services/user';
import {
  userPresenter as authUserPresenter,
  userEmailPresenter,
  userIdentityPresenter
} from '../../auth/presenters';
import { internalApp } from '../_app';

export let userController = internalApp.controller({
  list: internalApp
    .handler()
    .input(
      Paginator.validate(
        v.object({
          appId: v.string(),
          search: v.optional(v.string())
        })
      )
    )
    .do(async ({ input }) => {
      let app = await adminService.getApp({ appId: input.appId });
      let paginator = await adminService.listUsers({ app, search: input.search });
      let list = await paginator.run(input);
      return Paginator.presentLight(list, authUserPresenter);
    }),

  get: internalApp
    .handler()
    .input(
      v.object({
        id: v.string()
      })
    )
    .do(async ({ input }) => {
      let user = await adminService.getUser({ userId: input.id });
      return await authUserPresenter(user);
    }),

  listIdentities: internalApp
    .handler()
    .input(
      v.object({
        userId: v.string()
      })
    )
    .do(async ({ input }) => {
      let user = await userService.getUser({ userId: input.userId });
      let identities = await userService.listUserProfile({ user });
      return identities.map(identity => userIdentityPresenter({ ...identity, user }));
    }),

  listEmails: internalApp
    .handler()
    .input(
      v.object({
        userId: v.string()
      })
    )
    .do(async ({ input }) => {
      let user = await userService.getUser({ userId: input.userId });
      let emails = await userService.listUserEmails({ user });
      return emails.map(email => userEmailPresenter({ ...email, user }));
    }),

  update: internalApp
    .handler()
    .input(
      v.object({
        userId: v.string(),
        firstName: v.optional(v.string()),
        lastName: v.optional(v.string()),
        name: v.optional(v.string()),
        image: v.optional(v.any())
      })
    )
    .do(async ({ input }) => {
      let { userId, ...fields } = input;
      let user = await userService.getUser({ userId });
      let updated = await userService.updateUser({
        user,
        input: fields,
        context: { ip: '0.0.0.0', ua: 'internal' }
      });
      return authUserPresenter({ ...updated, userEmails: user.userEmails });
    }),

  setEmails: internalApp
    .handler()
    .input(
      v.object({
        userId: v.string(),
        emails: v.array(
          v.object({
            email: v.string(),
            isPrimary: v.boolean(),
            isVerified: v.boolean()
          })
        )
      })
    )
    .do(async ({ input }) => {
      let user = await userService.getUser({ userId: input.userId });
      let emails = await userService.setEmails({ user, emails: input.emails });
      return emails.map(email => userEmailPresenter({ ...email, user }));
    })
});
