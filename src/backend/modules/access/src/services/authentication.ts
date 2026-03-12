import { ServiceError, unauthorizedError } from '@lowerdeck/error';
import { UnifiedApiKey } from '@metorial/api-keys';
import { Context } from '@metorial/context';
import {
  ApiKey,
  FineGrainedKey,
  // ConsumerProfile,
  // ConsumerSession,
  // ConsumerSurface,
  Instance,
  MachineAccess,
  Organization,
  OrganizationActor,
  Project,
  User,
  UserSession
} from '@metorial/db';
import { Service } from '@lowerdeck/service';
import { machineAccessAuthService } from '@metorial/module-machine-access';
import { userAuthService } from '@metorial/module-user';
import {
  instancePublishableTokenScopes,
  instanceSecretTokenScopes,
  orgManagementTokenScopes,
  Scope,
  scopes
} from '../definitions';
import { fineGrainedAuthService } from './fineGrainedAuth';

export type FineGrainedAccessTagGrant = {
  resourceType: 'subspace.session';
  resourceId: string;
  roles: Scope[];
};

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

            // consumer:
            //   | {
            //       consumerSurface: ConsumerSurface;
            //       consumerSession: ConsumerSession;
            //       consumerProfile: ConsumerProfile;
            //     }
            //   | undefined;
          };
    }
  | {
      type: 'fine_grained';
      fineGrainedKey: FineGrainedKey;
      orgScopes: Scope[];
      restrictions: {
        type: 'instance';
        organization: Organization;
        instance: Instance & { project: Project };
        accessTagGrants: FineGrainedAccessTagGrant[];
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
          consumerSessionClientSecret?: string | null | undefined;
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
    consumerSessionClientSecret?: string | null | undefined;
  }): Promise<AuthInfo> {
    let parsed = UnifiedApiKey.from(d.apiKey);
    if (parsed?.type == 'fine_grained_token') {
      let res = await fineGrainedAuthService.authenticateWithFineGrainedToken({
        token: d.apiKey,
        context: d.context
      });

      return {
        type: 'fine_grained',
        fineGrainedKey: res.fineGrainedKey,
        orgScopes: res.orgScopes,
        restrictions: {
          type: 'instance',
          organization: res.fineGrainedKey.instance.organization,
          instance: res.fineGrainedKey.instance,
          accessTagGrants: res.accessTagGrants
        }
      };
    }

    let res = await machineAccessAuthService.authenticateWithMachineAccessToken({
      token: d.apiKey,
      context: d.context
    });
    let machineAccess = res.apiKey.machineAccess;

    if (
      machineAccess.instance &&
      machineAccess.organization &&
      machineAccess.actor &&
      (machineAccess.type == 'instance_publishable' || machineAccess.type == 'instance_secret')
    ) {
      // let consumerRes = d.consumerSessionClientSecret
      //   ? await consumerAuthService.authenticateWithConsumerToken({
      //       token: d.consumerSessionClientSecret,
      //       organization: machineAccess.organization
      //     })
      //   : null;

      // if (consumerRes && machineAccess.type != 'instance_publishable') {
      //   throw new ServiceError(
      //     unauthorizedError({
      //       message:
      //         'Consumer session tokens can only be used with instance publishable machine access tokens'
      //     })
      //   );
      // }

      return {
        type: 'machine',
        apiKey: res.apiKey,
        machineAccess,
        orgScopes:
          machineAccess.type == 'instance_publishable'
            ? // consumerRes ? instancePublishableTokenWithConsumerScopes :
              instancePublishableTokenScopes
            : instanceSecretTokenScopes,
        restrictions: {
          type: 'instance',
          organization: machineAccess.organization,
          actor: machineAccess.actor,
          instance: machineAccess.instance

          // consumer: consumerRes
          //   ? {
          //       consumerSurface: consumerRes.surface,
          //       consumerSession: consumerRes.session,
          //       consumerProfile: consumerRes.consumerProfile
          //     }
          //   : undefined
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
