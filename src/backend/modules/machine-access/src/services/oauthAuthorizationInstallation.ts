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
import { machineAccessService } from './machineAccess';
import { machineAccessInclude } from './machineAccessAuth';
import { authorizationInclude, OAuthAuthorizationWithRelations } from './oauthAuthorization';

export let installationInclude = {
  organization: true,
  oauthApplication: {
    include: {
      organization: true
    }
  },
  serverSideMachineAccess: {
    include: machineAccessInclude
  }
} as const;

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
      return await db.oAuthInstallation.upsert({
        where: {
          oauthApplicationOid_organizationOid: {
            oauthApplicationOid: d.oauthApplication.oid,
            organizationOid: d.organization.oid
          }
        },
        create: {
          id: await ID.generateId('oauthInstallation'),
          status: 'active',
          scopes: d.oauthApplication.scopes,
          oauthApplicationOid: d.oauthApplication.oid,
          organizationOid: d.organization.oid,
          serverSideMachineAccessOid: d.oauthApplication.serverSideMachineAccessOid
        },
        update: {
          status: 'active',
          revokedAt: null,
          scopes: d.oauthApplication.scopes,
          serverSideMachineAccessOid: d.oauthApplication.serverSideMachineAccessOid
        },
        include: installationInclude
      });
    });
  }

  async getOrCreateUserAuthorization(d: {
    oauthApplication: OAuthApplication;
    oauthInstallation: OAuthInstallation;
    organization: Organization;
    member: OrganizationMember & { actor: OrganizationActor; user: User };
    user: User;
    scopes: string[];
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
      }

      return await db.oAuthAuthorization.upsert({
        where: {
          organizationMemberOid_oauthApplicationOid: {
            organizationMemberOid: d.member.oid,
            oauthApplicationOid: d.oauthApplication.oid
          }
        },
        create: {
          id: await ID.generateId('oauthAuthorization'),
          status: 'active',
          type: 'user',
          scopes: d.scopes,
          oauthInstallationOid: d.oauthInstallation.oid,
          oauthApplicationOid: d.oauthApplication.oid,
          organizationOid: d.organization.oid,
          userOid: d.user.oid,
          organizationMemberOid: d.member.oid,
          machineAccessOid: machineAccessOid!,
          requestingIp: d.requestingIp,
          acceptingIp: d.acceptingIp
        },
        update: {
          status: 'active',
          scopes: d.scopes,
          oauthInstallationOid: d.oauthInstallation.oid,
          organizationOid: d.organization.oid,
          userOid: d.user.oid,
          organizationMemberOid: d.member.oid,
          machineAccessOid,
          requestingIp: d.requestingIp,
          acceptingIp: d.acceptingIp,
          revokedAt: null
        },
        include: authorizationInclude
      });
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

      return await db.oAuthAuthorization.create({
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
    });
  }

  async revokeOAuthInstallation(d: { oauthInstallation: OAuthInstallation }) {
    let now = new Date();

    return await withTransaction(async db => {
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

      return await db.oAuthInstallation.update({
        where: {
          oid: d.oauthInstallation.oid
        },
        data: {
          status: 'revoked',
          revokedAt: now
        },
        include: installationInclude
      });
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
