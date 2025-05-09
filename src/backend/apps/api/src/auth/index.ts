import { Context } from '@metorial/context';
import { cors, createHono, useRequestContext, useValidatedBody } from '@metorial/hono';
import { userAuthService } from '@metorial/module-user';
import { v } from '@metorial/validation';
import { getDashboardAuthCookie, setDashboardAuthCookie } from '../rest';

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
      origin: o => o,
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
