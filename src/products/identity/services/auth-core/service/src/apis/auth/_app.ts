import { Group } from '@lowerdeck/rpc-server';

export let publicApp = new Group().use(async ctx => {
  return {
    context: {
      ip: (ctx.ip ?? '0.0.0.0').split(',')[0]!.trim(),
      ua: ctx.headers.get('user-agent')
    }
  };
});
