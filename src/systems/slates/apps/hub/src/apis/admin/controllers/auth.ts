import { v } from '@mtsrc/validation';
import { adminAuthService } from '../../../services';
import { app, authedApp } from './_app';

let ADMIN_SESSION_COOKIE = 'slates_admin_session';

export let authController = app.controller({
  authEnabled: app
    .handler()
    .input(v.object({}))
    .do(async () => {
      return { enabled: await adminAuthService.isEnabled() };
    }),

  getAuthUrl: app
    .handler()
    .input(
      v.object({
        redirectUri: v.string()
      })
    )
    .do(async ctx => {
      let authUrl = await adminAuthService.getAuthUrl({
        redirectUri: ctx.input.redirectUri
      });

      return { authUrl };
    }),

  exchangeCode: app
    .handler()
    .input(
      v.object({
        code: v.string()
      })
    )
    .do(async ctx => {
      let { adminUser, session } = await adminAuthService.exchangeCode({
        code: ctx.input.code
      });

      ctx.setCookie(ADMIN_SESSION_COOKIE, session.token, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60
      });

      return {
        user: {
          id: adminUser.id,
          email: adminUser.email,
          name: adminUser.name
        }
      };
    }),

  me: authedApp
    .handler()
    .input(v.object({}))
    .do(async ctx => {
      if (!ctx.adminUser) {
        return { user: null };
      }

      return {
        user: {
          id: ctx.adminUser.id,
          email: ctx.adminUser.email,
          name: ctx.adminUser.name
        }
      };
    }),

  logout: authedApp
    .handler()
    .input(v.object({}))
    .do(async ctx => {
      ctx.setCookie(ADMIN_SESSION_COOKIE, '', {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 0
      });

      return {};
    })
});
