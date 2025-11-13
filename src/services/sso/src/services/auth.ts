import { notFoundError, ServiceError } from '@metorial/error';
import { Service } from '@metorial/service';
import { Auth, Connection, Tenant, User, UserProfile } from '../db/schema';
import { ID } from '../id';

class authServiceImpl {
  async createAuth(d: {
    tenant: Tenant;
    input: {
      redirectUri: string;
      email?: string;
      state: string;
    };
  }) {
    return await Auth.create({
      tenantId: d.tenant._id,
      status: 'pending',
      state: d.input.state,
      redirectUri: d.input.redirectUri,
      clientSecret: await ID.generateId('auth_clientSecret')
    });
  }

  async getAuthByClientSecret(d: { clientSecret: string }) {
    let auth = await Auth.findOne({ clientSecret: d.clientSecret });
    if (!auth) throw new ServiceError(notFoundError('sso.auth'));

    let tenant = (await Tenant.findById(auth.tenantId))!;

    return { auth, tenant };
  }

  async completeAuth(d: { authId: string }) {
    let auth = await Auth.findById(d.authId);
    if (!auth) throw new ServiceError(notFoundError('sso.auth'));

    let user = await User.findById(auth.userId);
    let tenant = await Tenant.findById(auth.tenantId);
    let connection = await Connection.findById(auth.connectionId);
    let userProfile = await UserProfile.findById(auth.userProfileId);

    if (!tenant) throw new ServiceError(notFoundError('sso.tenant'));
    if (!connection) throw new ServiceError(notFoundError('sso.connection'));
    if (!userProfile) throw new ServiceError(notFoundError('sso.userProfile'));
    if (!user) throw new ServiceError(notFoundError('sso.user'));

    await Auth.findByIdAndDelete(d.authId);

    return { auth, user, tenant, connection, userProfile };
  }
}

export let authService = Service.create('auth', () => new authServiceImpl()).build();
