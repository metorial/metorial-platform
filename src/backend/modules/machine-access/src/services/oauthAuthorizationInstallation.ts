import {
  badRequestError,
  forbiddenError,
  notFoundError,
  ServiceError
} from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { Context } from '@metorial/context';
import {
  addAfterTransactionHook,
  db,
  ID,
  MachineAccess,
  OAuthApplication,
  OAuthInstallation,
  OAuthInstallationStatus,
  Organization,
  OrganizationActor,
  OrganizationMember,
  User,
  withTransaction
} from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { createLock } from '@metorial/lock';
import { organizationActorService } from '@metorial/module-organization';
import { matchesUpdate } from '../lib/matches';
import { machineAccessService } from './machineAccess';
import { machineAccessInclude } from './machineAccessAuth';
import { authorizationInclude, OAuthAuthorizationWithRelations } from './oauthAuthorization';

export let installationInclude = {
  organization: true,
  appActor: true,
  oauthApplication: {
    include: {
      organization: true
    }
  },
  serverSideMachineAccess: {
    include: machineAccessInclude
  }
} as const;

let actorCreateLock = createLock({
  name: 'macc/oauth-install/actor-create'
});

class OAuthAuthorizationInstallationService {
  async getOrCreateInstallation(d: {
    oauthApplication: OAuthApplication & {
      scopedInstallation:
        | (OAuthInstallation & {
            serverSideMachineAccess: MachineAccess | null;
          })
        | null;
    };
    organization: Organization;
  }) {
    return await withTransaction(async db => {
      let existing = await db.oAuthInstallation.findFirst({
        where: {
          oauthApplicationOid: d.oauthApplication.oid,
          organizationOid: d.organization.oid
        },
        include: installationInclude
      });

      let inner = {
        status: 'active' as const,
        revokedAt: null,
        scopes: d.oauthApplication.scopes,
        organizationOid: d.organization.oid,
        oauthApplicationOid: d.oauthApplication.oid,
        serverSideMachineAccessOid: d.oauthApplication.serverSideMachineAccessOid
      };

      if (existing) {
        let needsUpdate = !matchesUpdate(existing, inner) || !existing.appActorOid;
        if (!needsUpdate) return existing;
      }

      if (existing) {
        await Fabric.fire('machine_access.oauth_installation.updated:before', {
          oauthApplication: d.oauthApplication,
          organization: d.organization
        });
      } else {
        await Fabric.fire('machine_access.oauth_installation.created:before', {
          oauthApplication: d.oauthApplication,
          organization: d.organization
        });
      }

      let newId = await ID.generateId('oauthInstallation');
      let installation = await db.oAuthInstallation.upsert({
        where: {
          oauthApplicationOid_organizationOid: {
            oauthApplicationOid: d.oauthApplication.oid,
            organizationOid: d.organization.oid
          }
        },
        create: {
          id: newId,
          ...inner
        },
        update: inner,
        include: installationInclude
      });

      if (!installation.appActorOid) {
        installation = await actorCreateLock.usingLock(d.organization.id, async () => {
          let currentInstallation = await db.oAuthInstallation.findFirstOrThrow({
            where: {
              oid: installation.oid
            },
            include: installationInclude
          });
          if (currentInstallation.appActorOid) {
            return currentInstallation;
          }

          let actor = await organizationActorService.createOrganizationActor({
            input: {
              type: 'oauth_application',
              name: `APP ${d.oauthApplication.name}`
            },
            organization: d.organization,
            performedBy: {
              type: 'actor',
              actor: await organizationActorService.getSystemActor({
                organization: d.organization
              })
            }
          });

          return await db.oAuthInstallation.update({
            where: {
              oid: installation.oid
            },
            data: {
              appActorOid: actor.oid
            },
            include: installationInclude
          });
        });
      }

      if (existing) {
        addAfterTransactionHook(() =>
          Fabric.fire('machine_access.oauth_installation.updated:after', {
            oauthApplication: installation.oauthApplication,
            oauthInstallation: installation,
            organization: installation.organization,
            appActor: installation.appActor
          })
        );
      } else {
        addAfterTransactionHook(() =>
          Fabric.fire('machine_access.oauth_installation.created:after', {
            oauthApplication: installation.oauthApplication,
            oauthInstallation: installation,
            organization: installation.organization,
            appActor: installation.appActor
          })
        );
      }

      return installation;
    });
  }

  async getOrCreateUserAuthorization(d: {
    oauthApplication: OAuthApplication;
    oauthInstallation: OAuthInstallation;
    organization: Organization;
    member: OrganizationMember & { actor: OrganizationActor; user: User };
    user: User;
    scopes: string[];
    oidcScopes?: string[];
    requestingIp?: string | null;
    acceptingIp?: string | null;
    context: Context;
  }): Promise<OAuthAuthorizationWithRelations> {
    return await withTransaction(async db => {
      let oauthAuthorization = await db.oAuthAuthorization.findFirst({
        where: {
          organizationMemberOid: d.member.oid,
          oauthApplicationOid: d.oauthApplication.oid
        },
        include: authorizationInclude
      });

      let machineAccess = oauthAuthorization?.machineAccess;
      let machineAccessOid = machineAccess?.oid;

      if (!machineAccess || machineAccess.status != 'active') {
        let createdMachineAccess = await machineAccessService.createMachineAccess({
          type: 'organization_management',
          organization: d.organization,
          performedBy: d.member.actor,
          context: d.context,
          kind: 'user',
          linkedTo: {
            type: 'user',
            actor: d.member.actor,
            user: d.user
          },
          input: {
            name: `OAUTH USER ${d.oauthApplication.name}`,
            hasCustomScopes: true,
            scopes: d.scopes
          }
        });
        machineAccessOid = createdMachineAccess.oid;
      } else {
        let name = `OAUTH USER ${d.oauthApplication.name}`;

        let needsUpdate = !matchesUpdate(machineAccess, {
          hasCustomScopes: true,
          scopes: d.scopes,
          name
        });

        if (needsUpdate) {
          let updatedMachineAccess = await machineAccessService.updateMachineAccess({
            machineAccess,
            input: {
              hasCustomScopes: true,
              scopes: d.scopes,
              name: `OAUTH USER ${d.oauthApplication.name}`
            },
            performedBy: d.member.actor,
            context: d.context
          });
          machineAccessOid = updatedMachineAccess.oid;
        } else {
          machineAccessOid = machineAccess.oid;
        }
      }

      let inner = {
        status: 'active' as const,
        scopes: d.scopes,
        oidcScopes: d.oidcScopes ?? [],
        oauthInstallationOid: d.oauthInstallation.oid,
        organizationOid: d.organization.oid,
        userOid: d.user.oid,
        organizationMemberOid: d.member.oid,
        machineAccessOid,
        requestingIp: d.requestingIp,
        acceptingIp: d.acceptingIp,
        revokedAt: null,
        type: 'user' as const,
        oauthApplicationOid: d.oauthApplication.oid
      };

      let needsUpdate = !oauthAuthorization || !matchesUpdate(oauthAuthorization, inner);
      if (!needsUpdate && oauthAuthorization) return oauthAuthorization;

      if (oauthAuthorization) {
        await Fabric.fire('machine_access.oauth_authorization.updated:before', {
          oauthApplication: d.oauthApplication,
          oauthInstallation: d.oauthInstallation,
          organization: d.organization,
          context: d.context
        });
      } else {
        await Fabric.fire('machine_access.oauth_authorization.created:before', {
          oauthApplication: d.oauthApplication,
          oauthInstallation: d.oauthInstallation,
          organization: d.organization,
          context: d.context
        });
      }

      let newId = await ID.generateId('oauthAuthorization');
      let updatedAuthorization = await db.oAuthAuthorization.upsert({
        where: {
          organizationMemberOid_oauthApplicationOid: {
            organizationMemberOid: d.member.oid,
            oauthApplicationOid: d.oauthApplication.oid
          }
        },
        create: {
          id: newId,
          ...inner
        },
        update: inner,
        include: authorizationInclude
      });

      if (oauthAuthorization) {
        addAfterTransactionHook(() =>
          Fabric.fire('machine_access.oauth_authorization.updated:after', {
            oauthApplication: updatedAuthorization.oauthApplication,
            oauthInstallation: updatedAuthorization.oauthInstallation,
            oauthAuthorization: updatedAuthorization,
            organization: updatedAuthorization.oauthInstallation.organization,
            appActor: updatedAuthorization.oauthInstallation.appActor,
            context: d.context
          })
        );
      } else {
        addAfterTransactionHook(() =>
          Fabric.fire('machine_access.oauth_authorization.created:after', {
            oauthApplication: updatedAuthorization.oauthApplication,
            oauthInstallation: updatedAuthorization.oauthInstallation,
            oauthAuthorization: updatedAuthorization,
            organization: updatedAuthorization.oauthInstallation.organization,
            appActor: updatedAuthorization.oauthInstallation.appActor,
            context: d.context
          })
        );
      }

      return updatedAuthorization;
    });
  }

  async getOrCreateServerSideAuthorization(d: {
    oauthApplication: OAuthApplication & {
      scopedInstallation:
        | (OAuthInstallation & {
            serverSideMachineAccess: MachineAccess | null;
          })
        | null;
      organization: Organization | null;
      serverSideMachineAccess: MachineAccess | null;
    };
    scopes: string[];
    ip?: string | null;
  }): Promise<OAuthAuthorizationWithRelations> {
    return await withTransaction(async db => {
      if (d.oauthApplication.type != 'server_side') {
        throw new ServiceError(
          forbiddenError({
            message: 'Only server-side oauth applications support client credentials'
          })
        );
      }

      if (!d.oauthApplication.organization) {
        throw new ServiceError(
          badRequestError({
            message: 'Server-side oauth application is missing its organization'
          })
        );
      }

      let installation = await this.getOrCreateInstallation({
        oauthApplication: d.oauthApplication,
        organization: d.oauthApplication.organization
      });

      let machineAccess =
        installation.serverSideMachineAccess ?? d.oauthApplication.serverSideMachineAccess;
      if (!machineAccess) {
        throw new ServiceError(
          badRequestError({
            message: 'Server-side oauth application is missing its shared machine access'
          })
        );
      }
      if (!machineAccess.actorOid) {
        throw new ServiceError(
          badRequestError({
            message: 'Server-side oauth application is missing its shared machine access actor'
          })
        );
      }

      await Fabric.fire('machine_access.oauth_authorization.created:before', {
        oauthApplication: d.oauthApplication,
        oauthInstallation: installation,
        organization: installation.organization,
        context: undefined
      });

      let authorization = await db.oAuthAuthorization.create({
        data: {
          id: await ID.generateId('oauthAuthorization'),
          status: 'active',
          type: 'server_side',
          scopes: d.scopes,
          oauthInstallationOid: installation.oid,
          oauthApplicationOid: d.oauthApplication.oid,
          organizationOid: installation.organizationOid,
          machineAccessOid: machineAccess.oid,
          requestingIp: d.ip,
          acceptingIp: d.ip
        },
        include: authorizationInclude
      });

      let serviceAccount = await db.serviceAccount.findFirst({
        where: {
          oauthApplicationOid: d.oauthApplication.oid
        }
      });

      if (serviceAccount) {
        await Fabric.fire('machine_access.service_account_credential.created:before', {
          serviceAccount,
          oauthApplication: authorization.oauthApplication,
          oauthInstallation: authorization.oauthInstallation,
          oauthAuthorization: authorization,
          organization: authorization.oauthInstallation.organization,
          appActor: authorization.oauthInstallation.appActor,
          context: undefined
        });

        let serviceAccountCredential = await db.serviceAccountCredential.create({
          data: {
            id: await ID.generateId('serviceAccountCredential'),
            serviceAccountOid: serviceAccount.oid,
            oauthAuthorizationOid: authorization.oid
          }
        });

        addAfterTransactionHook(() =>
          Fabric.fire('machine_access.service_account_credential.created:after', {
            serviceAccount,
            serviceAccountCredential,
            oauthApplication: authorization.oauthApplication,
            oauthInstallation: authorization.oauthInstallation,
            oauthAuthorization: authorization,
            organization: authorization.oauthInstallation.organization,
            appActor: authorization.oauthInstallation.appActor,
            context: undefined
          })
        );
      }

      addAfterTransactionHook(() =>
        Fabric.fire('machine_access.oauth_authorization.created:after', {
          oauthApplication: authorization.oauthApplication,
          oauthInstallation: authorization.oauthInstallation,
          oauthAuthorization: authorization,
          organization: authorization.oauthInstallation.organization,
          appActor: authorization.oauthInstallation.appActor,
          context: undefined
        })
      );

      return authorization;
    });
  }

  async revokeOAuthInstallation(d: {
    oauthInstallation: OAuthInstallation;
    performedBy: OrganizationActor;
    context?: Context;
  }) {
    let now = new Date();

    return await withTransaction(async db => {
      let existingInstallation = await db.oAuthInstallation.findFirstOrThrow({
        where: {
          oid: d.oauthInstallation.oid
        },
        include: installationInclude
      });

      await Fabric.fire('machine_access.oauth_installation.revoked:before', {
        oauthApplication: existingInstallation.oauthApplication,
        oauthInstallation: existingInstallation,
        organization: existingInstallation.organization,
        performedBy: d.performedBy,
        context: d.context
      });

      await db.oAuthAuthorization.updateMany({
        where: {
          oauthInstallationOid: d.oauthInstallation.oid,
          status: 'active'
        },
        data: {
          status: 'revoked',
          revokedAt: now
        }
      });

      let installation = await db.oAuthInstallation.update({
        where: {
          oid: d.oauthInstallation.oid
        },
        data: {
          status: 'revoked',
          revokedAt: now
        },
        include: installationInclude
      });

      addAfterTransactionHook(() =>
        Fabric.fire('machine_access.oauth_installation.revoked:after', {
          oauthApplication: installation.oauthApplication,
          oauthInstallation: installation,
          organization: installation.organization,
          appActor: installation.appActor,
          performedBy: d.performedBy,
          context: d.context
        })
      );

      return installation;
    });
  }

  async getOAuthInstallationById(d: {
    organization: Organization;
    oauthInstallationId: string;
  }) {
    let oauthInstallation = await db.oAuthInstallation.findFirst({
      where: {
        id: d.oauthInstallationId,
        organizationOid: d.organization.oid
      },
      include: installationInclude
    });

    if (!oauthInstallation) {
      throw new ServiceError(notFoundError('oauth_installation', d.oauthInstallationId));
    }

    return oauthInstallation;
  }

  async listOAuthInstallations(d: {
    organization: Organization;
    statuses?: OAuthInstallationStatus[];
    oauthApplicationIds?: string[];
  }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.oAuthInstallation.findMany({
            ...opts,
            where: {
              organizationOid: d.organization.oid,
              status: d.statuses ? { in: d.statuses } : undefined,
              oauthApplication: {
                id: d.oauthApplicationIds ? { in: d.oauthApplicationIds } : undefined,
                type: { not: 'server_side' }
              }
            },
            include: installationInclude
          })
      )
    );
  }
}

export let oauthAuthorizationInstallationService = Service.create(
  'oauthAuthorizationInstallationService',
  () => new OAuthAuthorizationInstallationService()
).build();
