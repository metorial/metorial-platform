import { Context } from '@metorial/context';
import {
  ApiKey,
  Instance,
  MachineAccess,
  Organization,
  OrganizationActor,
  Project,
  User,
  UserSession
} from '@metorial/db';
import { ServiceError, unauthorizedError } from '@metorial/error';
import { machineAccessAuthService } from '@metorial/module-machine-access';
import { userAuthService } from '@metorial/module-user';
import { Service } from '@metorial/service';
import {
  instancePublishableTokenScopes,
  instanceSecretTokenScopes,
  orgManagementTokenScopes,
  Scope,
  scopes
} from '../definitions';

export type AuthInfo =
  | {
      type: 'user';
      user: User;
      userSession?: UserSession;
      machineAccess?: MachineAccess;
      orgScopes: Scope[];
    }
  | {
      type: 'machine';
      apiKey: ApiKey;
      machineAccess: MachineAccess;
      orgScopes: Scope[];
      restrictions:
        | {
            type: 'organization';
            organization: Organization;
            actor: OrganizationActor;
          }
        | {
            type: 'instance';
            organization: Organization;
            actor: OrganizationActor;
            instance: Instance & { project: Project };
          };
    };

class AuthenticationService {
  async authenticate(
    d:
      | {
          type: 'user_session';
          sessionClientSecret: string;
          context: Context;
        }
      | {
          type: 'api_key';
          apiKey: string;
          context: Context;
        }
  ) {
    if (d.type == 'user_session') {
      return await this.authenticateUserSession(d);
    } else if (d.type == 'api_key') {
      return await this.authenticateApiKey(d);
    }

    throw new Error('Invalid authentication type');
  }

  private async authenticateUserSession(d: {
    sessionClientSecret: string;
    context: Context;
  }): Promise<AuthInfo> {
    let res = await userAuthService.authenticateWithSessionSecret({
      sessionClientSecret: d.sessionClientSecret,
      context: d.context
    });

    return {
      type: 'user',
      user: res.user,
      userSession: res.session,
      orgScopes: scopes
    };
  }

  async DANGEROUSLY_authenticateWithUserId(d: {
    userId: string;
    context: Context;
  }): Promise<AuthInfo> {
    let res = await userAuthService.DANGEROUSLY_authenticateWithUserId({
      userId: d.userId,
      context: d.context
    });

    return {
      type: 'user',
      user: res.user,
      orgScopes: scopes
    };
  }

  private async authenticateApiKey(d: {
    apiKey: string;
    context: Context;
  }): Promise<AuthInfo> {
    let res = await machineAccessAuthService.authenticateWithMachineAccessToken({
      token: d.apiKey,
      context: d.context
    });
    let machineAccess = res.apiKey.machineAccess;

    if (machineAccess.user && machineAccess.type == 'user_auth_token') {
      return {
        type: 'user',
        user: machineAccess.user,
        orgScopes: scopes
      };
    }

    if (
      machineAccess.instance &&
      machineAccess.organization &&
      machineAccess.actor &&
      (machineAccess.type == 'instance_publishable' || machineAccess.type == 'instance_secret')
    ) {
      return {
        type: 'machine',
        apiKey: res.apiKey,
        machineAccess,
        orgScopes:
          machineAccess.type == 'instance_publishable'
            ? instancePublishableTokenScopes
            : instanceSecretTokenScopes,
        restrictions: {
          type: 'instance',
          organization: machineAccess.organization,
          actor: machineAccess.actor,
          instance: machineAccess.instance
        }
      };
    }

    if (
      machineAccess.organization &&
      machineAccess.actor &&
      machineAccess.type == 'organization_management'
    ) {
      return {
        type: 'machine',
        apiKey: res.apiKey,
        machineAccess,
        orgScopes: orgManagementTokenScopes,
        restrictions: {
          type: 'organization',
          organization: machineAccess.organization,
          actor: machineAccess.actor
        }
      };
    }

    throw new ServiceError(
      unauthorizedError({
        message: 'This API key is not valid for this action'
      })
    );
  }
}

export let authenticationService = Service.create(
  'authenticationService',
  () => new AuthenticationService()
).build();
