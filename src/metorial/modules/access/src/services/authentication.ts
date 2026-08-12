import { ServiceError, unauthorizedError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { UnifiedApiKey } from '@metorial/api-keys';
import {
  authenticateWithConsumerToken,
  getConsumerAccessContextForSession
} from '@metorial/consumer-auth';
import { Context } from '@metorial/context';
import { createAuditScope, type AuditScope } from '@metorial/audit-scope';
import {
  ApiKey,
  Consumer,
  ConsumerProfile,
  ConsumerSession,
  ConsumerSurface,
  FineGrainedKey,
  Instance,
  MachineAccess,
  Organization,
  OrganizationActor,
  Portal,
  Project,
  ResourceActor,
  ResourceGroup,
  ResourceTenant,
  User,
  UserSession
} from '@metorial/db';
import {
  isIpAllowedByApiKeyFilters,
  machineAccessAuthService,
  type OAuthTokenWithAuthorization
} from '@metorial/module-machine-access';
import {
  resolveResourceScopeForOwner,
  resourceActorService
} from '@metorial/module-resource-tenant';
import { userAuthService } from '@metorial/module-user';
import {
  instancePublishableTokenScopes,
  instancePublishableTokenWithConsumerScopes,
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

export type AuthenticatedConsumerContext = {
  consumerSurface: ConsumerSurface;
  consumerSession: ConsumerSession;
  consumerProfile: ConsumerProfile & {
    consumer: Consumer;
    resourceActors: ResourceActor[];
  };
  consumerGroups: Awaited<
    ReturnType<typeof getConsumerAccessContextForSession>
  >['consumerGroups'];
  accessTags: bigint[];
  portal: Portal | null;
};

type AuthenticatedResourceScope = {
  resourceTenant: ResourceTenant;
  resourceGroup: ResourceGroup;
};

export type AuthInfo = {
  auditScope?: AuditScope;
} & (
  | {
      type: 'user';
      user: User;
      userSession?: UserSession;
      machineAccess?: MachineAccess;
      orgScopes: Scope[];
    }
  | {
      type: 'machine';
      user?: User;
      apiKey?: ApiKey;
      oauthToken?: OAuthTokenWithAuthorization;
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
            resourceTenant: ResourceTenant;
            resourceGroup: ResourceGroup;
            resourceActor: ResourceActor;
            consumer?: AuthenticatedConsumerContext | undefined;
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
        resourceTenant: ResourceTenant;
        resourceGroup: ResourceGroup;
        accessTagGrants: FineGrainedAccessTagGrant[];
      };
    }
);

class AuthenticationService {
  private async getResourceScopeForOwner(
    owner: Parameters<typeof resolveResourceScopeForOwner>[0],
    included?: {
      resourceTenant?: ResourceTenant | null;
      resourceGroup?: ResourceGroup | null;
    }
  ) {
    if (
      included?.resourceTenant &&
      included.resourceGroup &&
      included.resourceGroup.resourceTenantOid == included.resourceTenant.oid
    ) {
      return {
        resourceTenant: included.resourceTenant,
        resourceGroup: included.resourceGroup
      };
    }

    return await resolveResourceScopeForOwner(owner);
  }

  private async getOrganizationResourceActor(d: {
    resourceTenant: ResourceTenant;
    actor: OrganizationActor & { resourceActors?: ResourceActor[] };
  }) {
    let includedActor = d.actor.resourceActors?.find(
      actor => actor.resourceTenantOid == d.resourceTenant.oid
    );
    if (includedActor) return includedActor;

    return await resourceActorService.ensureOrganizationActor({
      resourceTenant: d.resourceTenant,
      organizationActorOid: d.actor.oid
    });
  }

  private async getConsumerProfileResourceActor(d: {
    resourceTenant: ResourceTenant;
    consumerProfile: ConsumerProfile & { resourceActors?: ResourceActor[] };
  }) {
    let includedActor = d.consumerProfile.resourceActors?.find(
      actor => actor.resourceTenantOid == d.resourceTenant.oid
    );
    if (includedActor) return includedActor;

    return await resourceActorService.ensureConsumerProfileActor({
      resourceTenant: d.resourceTenant,
      consumerProfile: d.consumerProfile
    });
  }

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
      if (d.consumerSessionClientSecret) {
        throw new ServiceError(
          unauthorizedError({
            message:
              'Consumer session tokens can only be used with instance publishable machine access tokens'
          })
        );
      }

      let res = await fineGrainedAuthService.authenticateWithFineGrainedToken({
        token: d.apiKey,
        context: d.context
      });
      let resourceScope = await this.getResourceScopeForOwner(
        {
          type: 'instance',
          instance: res.fineGrainedKey.instance
        },
        res.fineGrainedKey.instance
      );

      return {
        type: 'fine_grained',
        auditScope: createAuditScope({
          resourceTenant: resourceScope.resourceTenant,
          resourceGroup: resourceScope.resourceGroup,
          actor: {
            type: 'fine_grained_token',
            id: res.fineGrainedKey.id,
            metadata: {
              sessionIds: [
                ...new Set(
                  res.accessTagGrants
                    .filter(grant => grant.resourceType == 'subspace.session')
                    .map(grant => grant.resourceId)
                )
              ]
            }
          },
          context: d.context
        }),
        fineGrainedKey: res.fineGrainedKey,
        orgScopes: res.orgScopes,
        restrictions: {
          type: 'instance',
          organization: res.fineGrainedKey.instance.organization,
          instance: res.fineGrainedKey.instance,
          ...resourceScope,
          accessTagGrants: res.accessTagGrants
        }
      };
    }

    let rawRes = await machineAccessAuthService.authenticateWithMachineAccessToken({
      token: d.apiKey,
      context: d.context
    });
    let res =
      'type' in rawRes && rawRes.type == 'api_key' && 'secret' in rawRes
        ? rawRes
        : 'type' in rawRes && rawRes.type == 'oauth_token'
          ? rawRes
          : ({
              type: 'api_key',
              secret: {
                apiKey: (rawRes as any).apiKey
              }
            } as const);
    let machineAccess =
      res.type == 'api_key'
        ? res.secret!.apiKey.machineAccess
        : res.oauthToken!.oauthAuthorization.machineAccess;

    if (
      res.type == 'api_key' &&
      !isIpAllowedByApiKeyFilters({
        ip: d.context.ip,
        ipFilters: res.secret.apiKey.ipFilters
      })
    ) {
      throw new ServiceError(
        unauthorizedError({
          message: 'This API key is not allowed from your IP address'
        })
      );
    }

    if (d.consumerSessionClientSecret && machineAccess.type != 'instance_publishable') {
      throw new ServiceError(
        unauthorizedError({
          message:
            'Consumer session tokens can only be used with instance publishable machine access tokens'
        })
      );
    }

    if (
      machineAccess.instance &&
      machineAccess.organization &&
      machineAccess.actor &&
      (machineAccess.type == 'instance_publishable' || machineAccess.type == 'instance_secret')
    ) {
      let consumerRes =
        machineAccess.type == 'instance_publishable' && d.consumerSessionClientSecret
          ? await authenticateWithConsumerToken({
              token: d.consumerSessionClientSecret,
              organization: machineAccess.organization
            })
          : null;

      if (consumerRes && consumerRes.surface.instanceOid != machineAccess.instance.oid) {
        throw new ServiceError(
          unauthorizedError({
            message: 'Consumer session token does not belong to this instance'
          })
        );
      }

      if (
        consumerRes &&
        res.type == 'api_key' &&
        consumerRes.surface.publishableApiKeyOid != res.secret!.apiKey.oid
      ) {
        throw new ServiceError(
          unauthorizedError({
            message: 'Consumer session token does not belong to this publishable API key'
          })
        );
      }

      let consumerAccess = consumerRes
        ? await getConsumerAccessContextForSession({
            session: consumerRes.session
          })
        : undefined;

      let consumer =
        consumerRes && consumerAccess
          ? {
              consumerSurface: consumerRes.surface,
              consumerSession: consumerRes.session,
              consumerProfile: consumerRes.consumerProfile,
              consumerGroups: consumerAccess.consumerGroups,
              accessTags: consumerAccess.accessTags,
              portal: consumerRes.consumerProfile.surface.portal
            }
          : undefined;
      let resourceScope = await this.getResourceScopeForOwner(
        {
          type: 'instance',
          instance: machineAccess.instance
        },
        machineAccess.instance
      );
      let resourceActor = consumer
        ? await this.getConsumerProfileResourceActor({
            resourceTenant: resourceScope.resourceTenant,
            consumerProfile: consumer.consumerProfile
          })
        : await this.getOrganizationResourceActor({
            resourceTenant: resourceScope.resourceTenant,
            actor: machineAccess.actor
          });

      return {
        type: 'machine',
        auditScope: createAuditScope({
          resourceTenant: resourceScope.resourceTenant,
          resourceGroup: resourceScope.resourceGroup,
          resourceActor,
          actor: consumer
            ? {
                type: 'consumer_profile',
                id: consumer.consumerProfile.id
              }
            : {
                type: 'org_actor',
                id: machineAccess.actor.id
              },
          context: d.context
        }),
        apiKey: res.type == 'api_key' ? res.secret!.apiKey : undefined,
        oauthToken: res.type == 'oauth_token' ? res.oauthToken! : undefined,
        machineAccess,
        user:
          (res.type == 'oauth_token'
            ? (res.oauthToken.oauthAuthorization.user ?? machineAccess.user)
            : machineAccess.user) ?? undefined,
        orgScopes:
          res.type == 'oauth_token'
            ? (res.oauthToken!.oauthAuthorization.scopes as Scope[])
            : machineAccess.type == 'instance_publishable'
              ? consumer
                ? instancePublishableTokenWithConsumerScopes
                : instancePublishableTokenScopes
              : instanceSecretTokenScopes,
        restrictions: {
          type: 'instance',
          organization: machineAccess.organization,
          actor: machineAccess.actor,
          instance: machineAccess.instance,
          ...resourceScope,
          resourceActor,
          consumer
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
        apiKey: res.type == 'api_key' ? res.secret!.apiKey : undefined,
        oauthToken: res.type == 'oauth_token' ? res.oauthToken! : undefined,
        machineAccess,
        user:
          (res.type == 'oauth_token'
            ? (res.oauthToken.oauthAuthorization.user ?? machineAccess.user)
            : machineAccess.user) ?? undefined,
        orgScopes:
          res.type == 'oauth_token'
            ? (res.oauthToken!.oauthAuthorization.scopes as Scope[])
            : orgManagementTokenScopes,
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
