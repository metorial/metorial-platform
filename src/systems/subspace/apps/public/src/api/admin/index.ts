import { createHono } from '@lowerdeck/hono';
import { timingSafeEqual } from 'crypto';

let getAdminSecret = () => process.env.SUBSPACE_ADMIN_API_SECRET;

let isProduction = () => process.env.NODE_ENV === 'production';

let safeEquals = (a: string, b: string) => {
  let aBuffer = Buffer.from(a);
  let bBuffer = Buffer.from(b);

  return aBuffer.length === bBuffer.length && timingSafeEqual(aBuffer, bBuffer);
};

export let adminApp = createHono()
  .get('/ping', c => c.text('OK'))
  .use(async (c, next) => {
    let secret = getAdminSecret();

    if (!secret) {
      if (isProduction()) {
        return c.json({ error: 'Subspace admin API secret is not configured' }, 503);
      }

      await next();
      return;
    }

    let authorization = c.req.header('authorization');
    let bearerPrefix = 'Bearer ';

    if (!authorization?.startsWith(bearerPrefix)) {
      c.header('WWW-Authenticate', 'Bearer');
      return c.json({ error: 'Unauthorized' }, 401);
    }

    let token = authorization.slice(bearerPrefix.length);
    if (!safeEquals(token, secret)) {
      c.header('WWW-Authenticate', 'Bearer');
      return c.json({ error: 'Unauthorized' }, 401);
    }

    await next();
  })
  .get('/test', c =>
    c.json({
      ok: true,
      service: 'subspace-admin'
    })
  );
