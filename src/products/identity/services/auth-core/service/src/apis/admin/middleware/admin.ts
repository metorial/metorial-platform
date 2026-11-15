import { ServiceError, unauthorizedError } from '@lowerdeck/error';
import { Group } from '@lowerdeck/rpc-server';
import { adminService } from '../../../services/admin';

export const ADMIN_SESSION_COOKIE_NAME = 'metorial_admin_session';

export let publicApp = new Group().use(async ctx => {
  return {
    context: {
      ip: (ctx.ip ?? '0.0.0.0').split(',')[0]!.trim(),
      ua: ctx.headers.get('user-agent')
    }
  };
});

export let adminApp = publicApp.use(async ctx => {
  let clientSecret = ctx.getCookie(ADMIN_SESSION_COOKIE_NAME);
  if (clientSecret) {
    try {
      let admin = await adminService.authenticateAdmin({ clientSecret });
      return { admin };
    } catch {}
  }

  throw new ServiceError(unauthorizedError({ message: 'Unauthorized' }));
});
