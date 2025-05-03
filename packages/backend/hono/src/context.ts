import { parseForwardedFor } from '@metorial/ip-info';
import { Context } from 'hono';

export let useRequestContext = (c: Context) => {
  let ua = c.req.header('user-agent');
  let ip =
    parseForwardedFor(
      c.req.header('metorial-connecting-ip') ??
        c.req.header('cf-connecting-ip') ??
        c.req.header('x-forwarded-for') ??
        c.req.header('x-real-ip')
    ) ?? '127.0.0.1';

  return { ua, ip };
};
