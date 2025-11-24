import { Group } from '@metorial/rpc';

export let publicApp = new Group().use(async ctx => {
  return {
    context: {
      ip: ctx.ip ?? '0.0.0.0',
      ua: ctx.headers.get('user-agent')
    }
  };
});
