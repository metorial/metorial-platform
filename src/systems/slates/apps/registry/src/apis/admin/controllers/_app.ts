import { ServiceError, unauthorizedError } from '@lowerdeck/error';
import { Group } from '@lowerdeck/rpc-server';
import { adminAuthService } from '../../../services';

export let app = new Group();

let ADMIN_SESSION_COOKIE = 'slates_admin_session';

export let authedApp = app.use(async ctx => {
  if (!(await adminAuthService.isEnabled())) {
    return { adminUser: null };
  }

  let token = ctx.getCookie(ADMIN_SESSION_COOKIE);
  if (!token) {
    throw new ServiceError(unauthorizedError({ message: 'Not authenticated' }));
  }

  let { adminUser } = await adminAuthService.validateSession({ token });
  return { adminUser };
});
