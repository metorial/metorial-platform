import { cors, createHono, useRequestContext, useValidatedBody } from '@lowerdeck/hono';
import { v } from '@lowerdeck/validation';
import {
  getDashboardAuthCookie,
  isDashboardOrigin,
  setDashboardAuthCookie
} from '@metorial/auth';
import { getConfig } from '@metorial/config';
import { Context } from '@metorial/context';
import { userAuthService } from '@metorial/module-user';
import { RateLimiter } from '@metorial/rest';

let LOGIN_ATTEMPTS_PER_ADDRESS = 200;
let LOGIN_ATTEMPTS_PER_ACCOUNT = 50;
let LOGIN_ATTEMPTS_PER_ACCOUNT_AND_ADDRESS = 10;
let LOGIN_ATTEMPT_WINDOW_MS = 1000 * 60 * 15;

let loginRateLimiter = new RateLimiter<{ key: string; max: number }>(
  getConfig().redisUrl,
  ({ auth }) => auth.key,
  ({ auth }) => auth.max,
  { durationMs: LOGIN_ATTEMPT_WINDOW_MS }
);

let removeCurrentSession = async (req: Request, context: Context) => {
  let currentSession = getDashboardAuthCookie(req);
  if (currentSession) {
    try {
      let { session } = await userAuthService.authenticateWithSessionSecret({
        sessionClientSecret: currentSession,
        context
      });

      await userAuthService.logout({
        session,
        context
      });
    } catch (e) {
      // ignore
    }
  }
};

export let authApi = createHono()
  .use(
    cors({
      origin: origin => (isDashboardOrigin(origin) ? origin : null),
      allowMethods: ['POST', 'OPTIONS'],
      allowHeaders: ['Authorization', 'Content-Type', 'metorial-version'],
      credentials: true
    })
  )
  .post('/_/auth/login', async c => {
    let context = useRequestContext(c);
    let body = await useValidatedBody(
      c,
      v.object({
        email: v.string({ modifiers: [v.email()] }),
        password: v.string()
      })
    );

    let email = body.email.trim().toLowerCase();
    let loginLimits = [
      {
        key: `oss_login:account_address:${context.ip}:${email}`,
        max: LOGIN_ATTEMPTS_PER_ACCOUNT_AND_ADDRESS
      },
      { key: `oss_login:account:${email}`, max: LOGIN_ATTEMPTS_PER_ACCOUNT },
      ...(context.ip == '0.0.0.0'
        ? []
        : [{ key: `oss_login:ip:${context.ip}`, max: LOGIN_ATTEMPTS_PER_ADDRESS }])
    ];

    for (let auth of loginLimits) {
      let rateLimit = await loginRateLimiter.check({ auth, context });
      if (!rateLimit.allowed) return rateLimit.response;
    }

    let newSession = await userAuthService.loginWithPassword({
      context,
      input: {
        email: body.email,
        password: body.password
      }
    });

    await removeCurrentSession(c.req.raw, context);

    c.res.headers.append('Set-Cookie', setDashboardAuthCookie(newSession.clientSecret));

    return c.json({});
  })
  .post('/_/auth/signup', async c => {
    let context = useRequestContext(c);
    let body = await useValidatedBody(
      c,
      v.object({
        name: v.string(),
        email: v.string({ modifiers: [v.email()] }),
        password: v.string({ modifiers: [v.minLength(8)] })
      })
    );

    let newSession = await userAuthService.signupWithPassword({
      context,
      input: {
        name: body.name,
        email: body.email,
        password: body.password
      }
    });

    await removeCurrentSession(c.req.raw, context);

    c.res.headers.append('Set-Cookie', setDashboardAuthCookie(newSession.clientSecret));

    return c.json({});
  })
  .post('/_/auth/logout', async c => {
    let context = useRequestContext(c);

    await removeCurrentSession(c.req.raw, context);

    c.res.headers.append('Set-Cookie', setDashboardAuthCookie(''));

    return c.json({});
  });
