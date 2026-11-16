import { Group } from '@lowerdeck/rpc-server';
import { v } from '@lowerdeck/validation';

export let sessionCredentialValidator = v.string({ modifiers: [v.minLength(1)] });

export let app = new Group().use(async ctx => {
  return {
    context: {
      ip: ctx.ip ?? '0.0.0.0',
      ua: ctx.headers.get('user-agent') ?? 'unknown'
    }
  };
});
