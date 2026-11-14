import {
  badRequestError,
  forbiddenError,
  notFoundError,
  ServiceError
} from '@lowerdeck/error';
import { Hash } from '@lowerdeck/hash';
import { Service } from '@lowerdeck/service';
import { createOrganizationActorAuditScope } from '@metorial/audit-scope';
import { Context } from '@metorial/context';
import {
  addAfterTransactionHook,
  db,
  ID,
  Instance,
  MachineAccess,
  OAuthApplication,
  Organization,
  OrganizationActor,
  OrganizationMember,
  User,
  withTransaction
} from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { generateCustomId } from '@metorial/id';
import { organizationActorService } from '@metorial/module-organization/src/services/organizationActor';
import { addHours } from 'date-fns';
import { ensureScopesAllowed } from '../lib/oauthAuthorizationGuards';
import { validateOAuthScopes } from '../lib/oauthScopeValidation';
import { machineAccessService } from './machineAccess';
import { machineAccessInclude } from './machineAccessAuth';
import { authorizationInclude, oauthAuthorizationService } from './oauthAuthorization';
import {
  installationInclude,
  oauthAuthorizationInstallationService
} from './oauthAuthorizationInstallation';

let INTERNAL_TOKEN_REFRESH_BEFORE_HOURS = 1;

let internalOAuthApplicationInclude = {
  organization: true,
  scopedInstallation: {
    include: installationInclude
  },
  serverSideMachineAccess: {
    include: machineAccessInclude
  }
} as const;

let internalOAuthTokenInclude = {
  oauthApplication: {
    include: internalOAuthApplicationInclude
  },
  oauthInstallation: {
    include: installationInclude
  },
  oauthAuthorization: {
    include: authorizationInclude
  },
  oauthToken: {
    include: {
      oauthAuthorization: {
        include: authorizationInclude
      }
    }
  },
  machineAccess: {
    include: machineAccessInclude
  }
} as const;

type InternalOAuthApplicationWithRelations = OAuthApplication & {
  scopedInstallation: any;
  organization: Organization | null;
  serverSideMachineAccess: MachineAccess | null;
};

type InternalOAuthTokenSubject =
  | {
      type: 'member';
      member: OrganizationMember & {
        actor: OrganizationActor;
        user: User;
      };
    }
  | {
      type: 'machine';
      subjectIdentifier: string;
      name?: string;
    };

type InternalOAuthTokenScope =
  | {
      type: 'organization';
    }
  | {
      type: 'instance';
      instance: Instance;
    };

class InternalOAuthService {
  private normalizeSystemIdentifier(d: { systemIdentifier: string }) {
    let systemIdentifier = d.systemIdentifier.trim();
    if (!systemIdentifier.length) {
      throw new ServiceError(
        badRequestError({
          message: 'Internal oauth application systemIdentifier cannot be empty'
        })
      );
    }

    return systemIdentifier;
  }

  private async hash(value: unknown) {
    return await Hash.sha256(JSON.stringify(value));
  }

  private arraysEqual(a: string[], b: string[]) {
    if (a.length != b.length) return false;
    let sortedA = [...a].sort();
    let sortedB = [...b].sort();
    return sortedA.every((value, idx) => value == sortedB[idx]);
  }

  private jsonEqual(a: unknown, b: unknown) {
    return JSON.stringify(a) == JSON.stringify(b);
  }

  private assertInternalApplication(d: {
    oauthApplication: OAuthApplication;
    organization: Organization;
  }) {
    if (
      d.oauthApplication.type != 'internal' ||
      d.oauthApplication.organizationOid != d.organization.oid
    ) {
      throw new ServiceError(
        forbiddenError({
          message: 'Internal oauth tokens require an organization-owned internal app'
        })
      );
    }

    if (d.oauthApplication.status != 'active') {
      throw new ServiceError(
        forbiddenError({
          message: 'Internal oauth application is not active'
        })
      );
    }
  }

  private assertSubjectInOrganization(d: {
    organization: Organization;
    subject: InternalOAuthTokenSubject;
  }) {
    if (d.subject.type == 'machine') return;

    if (
      d.subject.member.organizationOid != d.organization.oid ||
      d.subject.member.actor.organizationOid != d.organization.oid
    ) {
      throw new ServiceError(
        forbiddenError({
          message: 'Internal oauth token subject belongs to another organization'
        })
      );
    }
  }

  private assertScopeInOrganization(d: {
    organization: Organization;
    scope: InternalOAuthTokenScope;
  }) {
    if (d.scope.type == 'organization') return;

    if (d.scope.instance.organizationOid != d.organization.oid) {
      throw new ServiceError(
        forbiddenError({
          message: 'Internal oauth token instance belongs to another organization'
        })
      );
    }
  }

  private assertActorInOrganization(d: {
    organization: Organization;
    actor?: OrganizationActor;
  }) {
    if (!d.actor) return;

    if (d.actor.organizationOid != d.organization.oid) {
      throw new ServiceError(
        forbiddenError({
          message: 'Internal oauth application actor belongs to another organization'
        })
      );
    }
  }

  private async getCacheKey(d: {
    oauthApplication: OAuthApplication;
    organization: Organization;
    subjectType: InternalOAuthTokenSubject['type'];
    subjectIdentifier: string;
    scope: InternalOAuthTokenScope;
    scopes: string[];
  }) {
    return await this.hash([
      'internal-oauth-token',
      d.oauthApplication.oid.toString(),
      d.oauthApplication.systemIdentifier,
      d.organization.oid.toString(),
      d.subjectType,
      d.subjectIdentifier,
      d.scope.type,
      d.scope.type == 'instance' ? d.scope.instance.oid.toString() : null,
      d.scopes
    ]);
  }

  private async getReusableMachineAccess(d: {
    existingInternalOAuthToken: any | null;
    organization: Organization;
    oauthApplication: OAuthApplication;
    subject: InternalOAuthTokenSubject;
    scope: InternalOAuthTokenScope;
    scopes: string[];
    context: Context;
  }) {
    if (
      d.existingInternalOAuthToken?.machineAccess &&
      d.existingInternalOAuthToken.machineAccess.status == 'active'
    ) {
      return d.existingInternalOAuthToken.machineAccess;
    }

    let input = {
      name:
        d.subject.type == 'machine'
          ? (d.subject.name ?? `INTERNAL OAUTH ${d.oauthApplication.name}`)
          : `INTERNAL OAUTH ${d.oauthApplication.name}`,
      hasCustomScopes: true,
      scopes: d.scopes
    };

    let actor =
      d.subject.type == 'member'
        ? d.subject.member.actor
        : await organizationActorService.getSystemActor({
            organization: d.organization
          });
    let auditScope = createOrganizationActorAuditScope({
      organization: d.organization,
      organizationActor: actor,
      instance: d.scope.type == 'instance' ? d.scope.instance : null,
      context: d.context
    });

    if (d.scope.type == 'organization') {
      return await machineAccessService.createMachineAccess({
        type: 'organization_management',
        organization: d.organization,
        auditScope,
        kind: d.subject.type == 'member' ? 'user' : 'api_key',
        linkedTo:
          d.subject.type == 'member'
            ? {
                type: 'user',
                actor: d.subject.member.actor,
                user: d.subject.member.user
              }
            : { type: 'new_actor' },
        input
      });
    }

    return await machineAccessService.createMachineAccess({
      type: 'instance_secret',
      organization: d.organization,
      instance: d.scope.instance,
      auditScope,
      kind: d.subject.type == 'member' ? 'user' : 'api_key',
      linkedTo:
        d.subject.type == 'member'
          ? {
              type: 'user',
              actor: d.subject.member.actor,
              user: d.subject.member.user
            }
          : { type: 'new_actor' },
      input
    });
  }

  private async getOrCreateInstallation(d: {
    oauthApplication: InternalOAuthApplicationWithRelations;
    organization: Organization;
    appActor?: OrganizationActor;
  }) {
    let installation = await oauthAuthorizationInstallationService.getOrCreateInstallation({
      oauthApplication: d.oauthApplication,
      organization: d.organization,
      appActor: d.appActor
    });

    if (d.oauthApplication.scopedInstallationOid != installation.oid) {
      await db.oAuthApplication.update({
        where: {
          oid: d.oauthApplication.oid
        },
        data: {
          scopedInstallationOid: installation.oid
        }
      });
    }

    return installation;
  }

  async ensureInternalOAuthApplication(d: {
    organization: Organization;
    systemIdentifier: string;
    performedBy: OrganizationActor;
    appActor?: OrganizationActor;
    context: Context;
    input: {
      name: string;
      description?: string | null;
      scopes: string[];
      image?: PrismaJson.EntityImage;
    };
  }) {
    let systemIdentifier = this.normalizeSystemIdentifier({
      systemIdentifier: d.systemIdentifier
    });
    let scopes = validateOAuthScopes(d.input.scopes);
    this.assertActorInOrganization({
      organization: d.organization,
      actor: d.appActor
    });

    let oauthApplication = await withTransaction(async db => {
      let existing = await db.oAuthApplication.findFirst({
        where: {
          organizationOid: d.organization.oid,
          systemIdentifier
        },
        include: internalOAuthApplicationInclude
      });

      let input = {
        status: 'active' as const,
        type: 'internal' as const,
        accessLevel: 'organization' as const,
        systemIdentifier,
        allowClientSecretlessTokenExchange: false,
        name: d.input.name,
        description: d.input.description,
        redirectUris: [] as string[],
        scopes,
        image: d.input.image ?? { type: 'default' as const }
      };

      let auditScope = createOrganizationActorAuditScope({
        organization: d.organization,
        organizationActor: d.performedBy,
        context: d.context
      });

      if (!existing) {
        await Fabric.fire('machine_access.oauth_application.created:before', {
          organization: d.organization,
          auditScope,
          input,
          serverSideMachineAccess: null
        });

        let oauthApplication = await db.oAuthApplication.create({
          data: {
            id: await ID.generateId('oauthApplication'),
            clientId: generateCustomId('mt_oauth_internal_', 32),
            ...input,
            organizationOid: d.organization.oid,
            websiteUrl: null,
            privacyPolicyUrl: null,
            termsOfServiceUrl: null,
            serverSideMachineAccessOid: null
          },
          include: internalOAuthApplicationInclude
        });

        addAfterTransactionHook(() =>
          Fabric.fire('machine_access.oauth_application.created:after', {
            organization: d.organization,
            auditScope,
            input,
            serverSideMachineAccess: null,
            oauthApplication
          })
        );

        return oauthApplication;
      }

      let update = {
        status: 'active' as const,
        name: d.input.name,
        description:
          d.input.description === undefined ? existing.description : d.input.description,
        scopes,
        image: d.input.image ?? (existing.image as PrismaJson.EntityImage),
        redirectUris: [] as string[],
        allowClientSecretlessTokenExchange: false
      };

      let appMatches =
        existing.status == update.status &&
        existing.name == update.name &&
        existing.description == update.description &&
        existing.allowClientSecretlessTokenExchange ==
          update.allowClientSecretlessTokenExchange &&
        this.arraysEqual(existing.scopes, update.scopes) &&
        this.arraysEqual(existing.redirectUris, update.redirectUris) &&
        this.jsonEqual(existing.image, update.image);
      if (appMatches) return existing;

      await Fabric.fire('machine_access.oauth_application.updated:before', {
        oauthApplication: existing,
        organization: d.organization,
        auditScope,
        input: update
      });

      let oauthApplication = await db.oAuthApplication.update({
        where: {
          oid: existing.oid
        },
        data: update,
        include: internalOAuthApplicationInclude
      });

      addAfterTransactionHook(() =>
        Fabric.fire('machine_access.oauth_application.updated:after', {
          oauthApplication,
          previousOAuthApplication: existing,
          organization: d.organization,
          auditScope,
          input: update
        })
      );

      return oauthApplication;
    });

    let installation = await this.getOrCreateInstallation({
      oauthApplication,
      organization: d.organization,
      appActor: d.appActor
    });

    if (
      !this.arraysEqual(installation.scopes, scopes) ||
      (d.appActor && installation.appActorOid != d.appActor.oid)
    ) {
      installation = await db.oAuthInstallation.update({
        where: {
          oid: installation.oid
        },
        data: {
          scopes,
          ...(d.appActor ? { appActorOid: d.appActor.oid } : {})
        },
        include: installationInclude
      });
    }

    return await db.oAuthApplication.findUniqueOrThrow({
      where: {
        oid: oauthApplication.oid
      },
      include: internalOAuthApplicationInclude
    });
  }

  async getInternalOAuthApplicationById(d: {
    organization: Organization;
    oauthApplicationId: string;
  }) {
    let oauthApplication = await db.oAuthApplication.findFirst({
      where: {
        id: d.oauthApplicationId,
        organizationOid: d.organization.oid,
        type: 'internal'
      },
      include: internalOAuthApplicationInclude
    });

    if (!oauthApplication) {
      throw new ServiceError(notFoundError('oauth_application', d.oauthApplicationId));
    }

    return oauthApplication;
  }

  async getInternalOAuthInstallationById(d: {
    organization: Organization;
    oauthInstallationId: string;
  }) {
    let oauthInstallation = await db.oAuthInstallation.findFirst({
      where: {
        id: d.oauthInstallationId,
        organizationOid: d.organization.oid,
        oauthApplication: {
          type: 'internal'
        }
      },
      include: installationInclude
    });

    if (!oauthInstallation) {
      throw new ServiceError(notFoundError('oauth_installation', d.oauthInstallationId));
    }

    return oauthInstallation;
  }

  async getInternalOAuthAuthorizationById(d: {
    organization: Organization;
    oauthAuthorizationId: string;
  }) {
    let oauthAuthorization = await db.oAuthAuthorization.findFirst({
      where: {
        id: d.oauthAuthorizationId,
        organizationOid: d.organization.oid,
        oauthApplication: {
          type: 'internal'
        }
      },
      include: authorizationInclude
    });

    if (!oauthAuthorization) {
      throw new ServiceError(notFoundError('oauth_authorization', d.oauthAuthorizationId));
    }

    return oauthAuthorization;
  }

  async getInternalOAuthTokenById(d: {
    organization: Organization;
    internalOAuthTokenId: string;
  }) {
    let internalOAuthToken = await db.internalOAuthToken.findFirst({
      where: {
        id: d.internalOAuthTokenId,
        organizationOid: d.organization.oid,
        oauthApplication: {
          type: 'internal'
        }
      },
      include: internalOAuthTokenInclude
    });

    if (!internalOAuthToken) {
      throw new ServiceError(notFoundError('internal_oauth_token', d.internalOAuthTokenId));
    }

    return internalOAuthToken;
  }

  async ensureToken(d: {
    oauthApplication: InternalOAuthApplicationWithRelations;
    organization: Organization;
    subject: InternalOAuthTokenSubject;
    scope: InternalOAuthTokenScope;
    scopes?: string[];
    context: Context;
  }) {
    this.assertInternalApplication({
      oauthApplication: d.oauthApplication,
      organization: d.organization
    });
    this.assertSubjectInOrganization({
      organization: d.organization,
      subject: d.subject
    });
    this.assertScopeInOrganization({
      organization: d.organization,
      scope: d.scope
    });

    let scopes = ensureScopesAllowed({
      allowedScopes: d.oauthApplication.scopes,
      requestedScopes: d.scopes
    });
    let subjectIdentifier =
      d.subject.type == 'member'
        ? d.subject.member.oid.toString()
        : this.normalizeSystemIdentifier({
            systemIdentifier: d.subject.subjectIdentifier
          });
    let cacheKeyHash = await this.getCacheKey({
      oauthApplication: d.oauthApplication,
      organization: d.organization,
      subjectType: d.subject.type,
      subjectIdentifier,
      scope: d.scope,
      scopes
    });
    let scopeHash = await this.hash(scopes);
    let reusableAfter = addHours(new Date(), INTERNAL_TOKEN_REFRESH_BEFORE_HOURS);

    let existingInternalOAuthToken = await db.internalOAuthToken.findUnique({
      where: {
        cacheKeyHash
      },
      include: internalOAuthTokenInclude
    });

    if (
      existingInternalOAuthToken &&
      existingInternalOAuthToken.expiresAt > reusableAfter &&
      existingInternalOAuthToken.oauthToken.accessTokenExpiresAt > reusableAfter &&
      existingInternalOAuthToken.oauthToken.oauthAuthorization.status == 'active' &&
      existingInternalOAuthToken.oauthToken.oauthAuthorization.oauthApplication.status ==
        'active' &&
      existingInternalOAuthToken.oauthToken.oauthAuthorization.oauthInstallation.status ==
        'active' &&
      existingInternalOAuthToken.oauthToken.oauthAuthorization.machineAccess.status == 'active'
    ) {
      return {
        internalOAuthToken: existingInternalOAuthToken,
        oauthToken: existingInternalOAuthToken.oauthToken,
        oauthAuthorization: existingInternalOAuthToken.oauthToken.oauthAuthorization,
        oauthInstallation:
          existingInternalOAuthToken.oauthToken.oauthAuthorization.oauthInstallation,
        oauthApplication:
          existingInternalOAuthToken.oauthToken.oauthAuthorization.oauthApplication
      };
    }

    return await withTransaction(async db => {
      let oauthInstallation = await this.getOrCreateInstallation({
        oauthApplication: d.oauthApplication,
        organization: d.organization
      });

      let machineAccess = await this.getReusableMachineAccess({
        existingInternalOAuthToken,
        organization: d.organization,
        oauthApplication: d.oauthApplication,
        subject: d.subject,
        scope: d.scope,
        scopes,
        context: d.context
      });

      await Fabric.fire('machine_access.oauth_authorization.created:before', {
        oauthApplication: d.oauthApplication,
        oauthInstallation,
        organization: d.organization
      });

      let oauthAuthorization = await db.oAuthAuthorization.create({
        data: {
          id: await ID.generateId('oauthAuthorization'),
          status: 'active',
          type: d.subject.type == 'member' ? 'user' : 'server_side',
          scopes,
          oidcScopes: [],
          oauthInstallationOid: oauthInstallation.oid,
          oauthApplicationOid: d.oauthApplication.oid,
          organizationOid: d.organization.oid,
          instanceOid: d.scope.type == 'instance' ? d.scope.instance.oid : null,
          machineAccessOid: machineAccess.oid,
          requestingIp: d.context.ip,
          acceptingIp: d.context.ip
        },
        include: authorizationInclude
      });

      addAfterTransactionHook(() =>
        Fabric.fire('machine_access.oauth_authorization.created:after', {
          oauthApplication: oauthAuthorization.oauthApplication,
          oauthInstallation: oauthAuthorization.oauthInstallation,
          oauthAuthorization,
          organization: oauthAuthorization.oauthInstallation.organization,
          appActor: oauthAuthorization.oauthInstallation.appActor
        })
      );

      let oauthToken = await oauthAuthorizationService.issueInternalOAuthToken({
        oauthAuthorization,
        context: d.context
      });

      let internalOAuthToken = await db.internalOAuthToken.upsert({
        where: {
          cacheKeyHash
        },
        create: {
          id: await ID.generateId('internalOAuthToken'),
          cacheKeyHash,
          subjectType: d.subject.type,
          subjectIdentifier,
          scopeType: d.scope.type,
          scopes,
          scopeHash,
          oauthApplicationOid: d.oauthApplication.oid,
          oauthInstallationOid: oauthInstallation.oid,
          oauthAuthorizationOid: oauthAuthorization.oid,
          oauthTokenOid: oauthToken.oid,
          organizationOid: d.organization.oid,
          instanceOid: d.scope.type == 'instance' ? d.scope.instance.oid : null,
          organizationMemberOid: d.subject.type == 'member' ? d.subject.member.oid : null,
          machineAccessOid: machineAccess.oid,
          expiresAt: oauthToken.accessTokenExpiresAt
        },
        update: {
          subjectType: d.subject.type,
          subjectIdentifier,
          scopeType: d.scope.type,
          scopes,
          scopeHash,
          oauthInstallationOid: oauthInstallation.oid,
          oauthAuthorizationOid: oauthAuthorization.oid,
          oauthTokenOid: oauthToken.oid,
          instanceOid: d.scope.type == 'instance' ? d.scope.instance.oid : null,
          organizationMemberOid: d.subject.type == 'member' ? d.subject.member.oid : null,
          machineAccessOid: machineAccess.oid,
          expiresAt: oauthToken.accessTokenExpiresAt
        },
        include: internalOAuthTokenInclude
      });

      return {
        internalOAuthToken,
        oauthToken,
        oauthAuthorization,
        oauthInstallation,
        oauthApplication: oauthAuthorization.oauthApplication
      };
    });
  }
}

export let internalOAuthService = Service.create(
  'internalOAuthService',
  () => new InternalOAuthService()
).build();
