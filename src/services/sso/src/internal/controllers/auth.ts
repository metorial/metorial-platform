import { v } from '@metorial/validation';
import { authPresenter } from '../../presenters/auth';
import { connectionPresenter } from '../../presenters/connection';
import { profilePresenter } from '../../presenters/profile';
import { tenantPresenter } from '../../presenters/tenant';
import { userPresenter } from '../../presenters/user';
import { authService } from '../../services/auth';
import { tenantService } from '../../services/tenant';
import { internalApp } from '../_app';

export let authController = internalApp.controller({
  start: internalApp
    .handler()
    .input(
      v.object({
        tenantId: v.string(),
        state: v.string(),
        redirectUri: v.string({ modifiers: [v.url()] }),
        email: v.optional(v.string({ modifiers: [v.email()] }))
      })
    )
    .do(async ctx => {
      let tenant = await tenantService.getTenantById({ tenantId: ctx.input.tenantId });

      let auth = await authService.createAuth({
        tenant,
        input: {
          state: ctx.input.state,
          redirectUri: ctx.input.redirectUri,
          email: ctx.input.email
        }
      });

      return authPresenter(auth);
    }),

  complete: internalApp
    .handler()
    .input(
      v.object({
        authId: v.string()
      })
    )
    .do(async ctx => {
      let authResult = await authService.completeAuth({
        authId: ctx.input.authId
      });

      return {
        auth: authPresenter(authResult.auth),
        user: userPresenter(authResult.user),
        tenant: tenantPresenter(authResult.tenant),
        connection: connectionPresenter(authResult.connection),
        profile: profilePresenter(authResult.userProfile)
      };
    })
});
