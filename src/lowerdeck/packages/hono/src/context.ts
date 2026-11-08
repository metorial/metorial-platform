import { extractTrustedClientIp } from '@lowerdeck/forwarded-for';
import { Context } from 'hono';

export let useRequestContext = (c: Context) => {
  let ua = c.req.header('user-agent');
  let ip = extractTrustedClientIp(c.req.raw.headers) ?? '0.0.0.0';

  return { ua, ip };
};
