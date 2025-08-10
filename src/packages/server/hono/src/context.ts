import { parseForwardedFor } from '@metorial/forwarded-for';
import { Context } from 'hono';

export let useRequestContext = (c: Context) => {
  let ua = c.req.header('user-agent');
  let ip =
    parseForwardedFor(
      c.req.header('metorial-connecting-ip') ??
        c.req.header('cf-connecting-ip') ??
        c.req.header('x-forwarded-for') ??
        c.req.header('x-real-ip')
    ) ?? '0.0.0.0';

  return { ua, ip };
};
