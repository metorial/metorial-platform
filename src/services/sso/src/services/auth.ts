import { notFoundError, ServiceError } from '@metorial/error';
import { Service } from '@metorial/service';
import { Auth, Tenant } from '../db/schema';
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
}

export let authService = Service.create('auth', () => new authServiceImpl()).build();
