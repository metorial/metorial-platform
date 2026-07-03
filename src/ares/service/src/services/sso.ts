import type {
  DirectorySyncEvent,
  DirectoryType,
  Group,
  User,
  UserWithGroup
} from '@boxyhq/saml-jackson';
import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { generatePlainId } from '@lowerdeck/id';
import { Paginator } from '@lowerdeck/pagination';
import { createHash } from 'crypto';
import type {
  App,
  SsoConnection,
  SsoConnectionStatus,
  SsoDirectory,
  SsoDirectoryStatus,
  SsoTenant,
  SsoUser,
  SsoUserProfile
} from '../../prisma/generated/client';
import { db, withTransaction } from '../db';
import { getId, ID } from '../id';
import { jackson } from '../lib/jackson';
import { reconcileSingleSsoUserQueue } from '../queues/reconcileSsoUsers';

let uniqueValues = (values: string[]) => {
  let seen = new Set<string>();
  let out: string[] = [];

  for (let value of values.filter(Boolean)) {
    if (seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }

  return out;
};

let hashUid = (uid: string) => createHash('sha256').update(uid).digest('hex');

let isUniqueConstraintError = (error: unknown) => (error as any)?.code === 'P2002';

type SsoDirectoryWithApp = SsoDirectory & {
  connection?: SsoConnection & {
    tenant?: SsoTenant;
  };
};

class SsoServiceImpl {
  private async enqueueSsoUserReconciliation(user: SsoUser) {
    await reconcileSingleSsoUserQueue.addManyWithOps([
      {
        data: { ssoUserId: user.id },
        opts: { id: user.id }
      }
    ]);
  }

  private async setSsoUserOwnerProfile(d: {
    user: SsoUser;
    profile: SsoUserProfile;
    enqueueReconciliation?: boolean;
  }) {
    let user = await db.ssoUser.update({
      where: { oid: d.user.oid },
      data: { ownerProfileOid: d.profile.oid }
    });

    if (d.enqueueReconciliation ?? true) {
      await this.enqueueSsoUserReconciliation(user);
    }

    return user;
  }

  async createTenant(d: {
    app: App;
    input: {
      name: string;
      metadata?: Record<string, any>;
      externalId?: string;
      hideInUI?: boolean;
    };
  }) {
    return await db.ssoTenant.create({
      data: {
        ...getId('ssoTenant'),
        clientId: await ID.generateId('ssoTenant_clientId'),
        appOid: d.app.oid,
        name: d.input.name,
        metadata: d.input.metadata,
        externalId: d.input.externalId,
        hideInUI: !!d.input.hideInUI
      },
      include: {
        _count: { select: { connections: true } },
        ssoTenantDomain: true
      }
    });
  }

  async updateTenant(d: {
    tenant: SsoTenant;
    input: {
      name?: string;
      metadata?: Record<string, any>;
      externalId?: string;
      hideInUI?: boolean;
    };
  }) {
    return await db.ssoTenant.update({
      where: { oid: d.tenant.oid },
      data: {
        name: d.input.name,
        metadata: d.input.metadata,
        externalId: d.input.externalId,
        hideInUI: d.input.hideInUI
      },
      include: {
        _count: { select: { connections: true } },
        ssoTenantDomain: true
      }
    });
  }

  async getTenantById(d: { tenantId: string }) {
    let tenant = await db.ssoTenant.findUnique({
      where: { id: d.tenantId },
      include: {
        _count: { select: { connections: true } },
        ssoTenantDomain: true
      }
    });
    if (!tenant) throw new ServiceError(notFoundError('sso.tenant'));
    return tenant;
  }

  async getTenantByClientId(d: { clientId: string }) {
    let tenant = await db.ssoTenant.findUnique({ where: { clientId: d.clientId } });
    if (!tenant) throw new ServiceError(notFoundError('sso.tenant'));
    return tenant;
  }

  async listTenants(d: { app: App }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.ssoTenant.findMany({
            ...opts,
            where: { appOid: d.app.oid },
            include: {
              _count: { select: { connections: true } },
              ssoTenantDomain: true
            }
          })
      )
    );
  }

  async listGlobalTenants() {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.ssoTenant.findMany({
            ...opts,
            where: { isGlobal: true },
            include: {
              _count: { select: { connections: true } },
              app: { select: { id: true, clientId: true } },
              ssoTenantDomain: true
            }
          })
      )
    );
  }

  async setGlobal(d: { tenant: SsoTenant; isGlobal: boolean }) {
    return await db.ssoTenant.update({
      where: { oid: d.tenant.oid },
      data: { isGlobal: d.isGlobal },
      include: {
        _count: { select: { connections: true } },
        ssoTenantDomain: true
      }
    });
  }

  async addTenantDomain(d: {
    tenant: SsoTenant;
    input: {
      domain: string;
    };
  }) {
    let domain = d.input.domain.trim().toLowerCase();
    if (!domain) {
      throw new ServiceError(badRequestError({ message: 'Domain is required' }));
    }

    let existing = await db.ssoTenantDomain.findFirst({
      where: {
        appOid: d.tenant.appOid,
        domain
      }
    });
    if (existing) {
      if (existing.tenantOid === d.tenant.oid) return existing;
      throw new ServiceError(
        badRequestError({ message: 'Domain already exists for another SSO tenant' })
      );
    }

    return await db.ssoTenantDomain.create({
      data: {
        ...getId('ssoTenantDomain'),
        domain,
        tenantOid: d.tenant.oid,
        appOid: d.tenant.appOid
      }
    });
  }

  async removeTenantDomain(d: { tenant: SsoTenant; domain: string }) {
    let domain = d.domain.trim().toLowerCase();

    let tenantDomain = await db.ssoTenantDomain.findFirst({
      where: {
        tenantOid: d.tenant.oid,
        appOid: d.tenant.appOid,
        domain
      }
    });
    if (!tenantDomain) throw new ServiceError(notFoundError('sso.tenant_domain'));

    await db.ssoTenantDomain.delete({ where: { oid: tenantDomain.oid } });

    return tenantDomain;
  }

  async getTenantByDomain(d: { app: App; domain: string }) {
    let tenantDomain = await db.ssoTenantDomain.findFirst({
      where: {
        appOid: d.app.oid,
        domain: d.domain.trim().toLowerCase(),
        tenant: {
          status: 'completed',
          connections: {
            some: {}
          }
        }
      },
      include: {
        tenant: true
      }
    });

    return tenantDomain?.tenant ?? null;
  }

  async createSamlConnection(d: {
    tenant: SsoTenant;
    input: {
      name: string;
      metadata?: Record<string, any>;
      provider: string;
      samlMetadata: { type: 'xml'; payload: string } | { type: 'url'; url: string };
    };
  }) {
    let con = await jackson.apiController.createSAMLConnection({
      product: 'metorial',
      tenant: d.tenant.id,
      name: d.input.name,
      redirectUrl: jackson.redirectUrl,
      defaultRedirectUrl: jackson.defaultRedirectUrl.saml,
      rawMetadata:
        d.input.samlMetadata.type === 'xml' ? d.input.samlMetadata.payload : undefined!,
      metadataUrl: d.input.samlMetadata.type === 'url' ? d.input.samlMetadata.url : undefined
    });

    if (d.tenant.status == 'pending') {
      await db.ssoTenant.update({
        where: { oid: d.tenant.oid },
        data: { status: 'completed' }
      });
    }

    return await db.ssoConnection.create({
      data: {
        ...getId('ssoConnection'),
        tenantOid: d.tenant.oid,
        internalId: con.clientID,
        internalClientId: con.clientID,
        internalClientSecret: con.clientSecret,
        providerType: 'saml',
        providerName: d.input.provider,
        name: d.input.name,
        metadata: d.input.metadata ?? undefined
      }
    });
  }

  async createOidcConnection(d: {
    tenant: SsoTenant;
    input: {
      name: string;
      metadata?: Record<string, any>;
      provider: string;
      oidcDiscoveryUrl: string;
      clientId: string;
      clientSecret: string;
    };
  }) {
    let internalId = generatePlainId(20);

    let con = await jackson.apiController.createOIDCConnection({
      product: 'metorial',
      tenant: internalId,
      name: d.input.name,
      oidcMetadata: undefined,
      oidcDiscoveryUrl: d.input.oidcDiscoveryUrl,
      oidcClientId: d.input.clientId,
      oidcClientSecret: d.input.clientSecret,
      redirectUrl: jackson.redirectUrl,
      defaultRedirectUrl: jackson.defaultRedirectUrl.oidc
    });

    if (d.tenant.status == 'pending') {
      await db.ssoTenant.update({
        where: { oid: d.tenant.oid },
        data: { status: 'completed' }
      });
    }

    return await db.ssoConnection.create({
      data: {
        ...getId('ssoConnection'),
        tenantOid: d.tenant.oid,
        internalId,
        internalClientId: con.clientID,
        internalClientSecret: con.clientSecret,
        providerType: 'oidc',
        providerName: d.input.provider,
        name: d.input.name,
        metadata: d.input.metadata ?? undefined
      }
    });
  }

  async listConnections(d: { tenant: SsoTenant }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.ssoConnection.findMany({
            ...opts,
            where: { tenantOid: d.tenant.oid }
          })
      )
    );
  }

  async getConnectionsByTenant(d: { tenant: SsoTenant }) {
    return await db.ssoConnection.findMany({
      where: { tenantOid: d.tenant.oid, status: 'active' }
    });
  }

  async getConnectionById(d: { connectionId: string; tenant: SsoTenant }) {
    let con = await db.ssoConnection.findFirst({
      where: { id: d.connectionId, tenantOid: d.tenant.oid }
    });
    if (!con) throw new ServiceError(notFoundError('sso.connection'));
    return con;
  }

  async setConnectionStatus(d: {
    tenant: SsoTenant;
    connection: SsoConnection;
    status: SsoConnectionStatus;
  }) {
    if (d.connection.tenantOid !== d.tenant.oid) {
      throw new ServiceError(notFoundError('sso.connection'));
    }

    if (d.status === 'disabled') {
      await db.ssoUserProfile.updateMany({
        where: { connectionOid: d.connection.oid },
        data: { status: 'deprovisioned' }
      });

      await db.ssoDirectory.updateMany({
        where: { connectionOid: d.connection.oid },
        data: { status: 'disabled' }
      });
    }

    return await db.ssoConnection.update({
      where: { oid: d.connection.oid },
      data: { status: d.status }
    });
  }

  async createDirectory(d: {
    tenant: SsoTenant;
    connection: SsoConnection;
    input: {
      name: string;
      type: DirectoryType;
      metadata?: Record<string, any>;
    };
  }) {
    if (d.connection.tenantOid !== d.tenant.oid) {
      throw new ServiceError(notFoundError('sso.connection'));
    }
    if (d.connection.status !== 'active') {
      throw new ServiceError(badRequestError({ message: 'Connection is disabled' }));
    }

    let res = await jackson.directorySyncController.directories.create({
      name: d.input.name,
      type: d.input.type,
      tenant: d.connection.internalId,
      product: 'metorial'
    });

    if (res.error || !res.data) {
      throw new ServiceError(
        badRequestError({
          message: `Could not create SCIM directory: ${res.error ?? 'unknown error'}`
        })
      );
    }

    let directory = await db.ssoDirectory.create({
      data: {
        ...getId('ssoDirectory'),
        connectionOid: d.connection.oid,
        internalId: res.data.id,
        name: res.data.name ?? d.input.name,
        type: res.data.type ?? d.input.type,
        scimPath: res.data.scim?.path ?? `/sso/scim/${res.data.id}`,
        scimEndpoint: res.data.scim?.endpoint ?? '',
        scimSecret: res.data.scim?.secret ?? '',
        metadata: d.input.metadata ?? undefined
      }
    });

    return {
      directory,
      scim: {
        endpoint: res.data.scim?.endpoint,
        secret: res.data.scim?.secret
      }
    };
  }

  async listDirectories(d: { connection: SsoConnection }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.ssoDirectory.findMany({
            ...opts,
            where: { connectionOid: d.connection.oid }
          })
      )
    );
  }

  async getDirectoryById(d: {
    tenant: SsoTenant;
    connection: SsoConnection;
    directoryId: string;
  }) {
    let directory = await db.ssoDirectory.findFirst({
      where: {
        id: d.directoryId,
        connectionOid: d.connection.oid,
        connection: { tenantOid: d.tenant.oid }
      }
    });
    if (!directory) throw new ServiceError(notFoundError('sso.directory'));
    return directory;
  }

  async getDirectoryByInternalId(d: { internalId: string }) {
    let directory = await db.ssoDirectory.findFirst({
      where: {
        internalId: d.internalId,
        status: 'active',
        connection: { status: 'active' }
      },
      include: { connection: { include: { tenant: true } } }
    });
    if (!directory) throw new ServiceError(notFoundError('sso.directory'));
    return directory;
  }

  async recordScimOperation(d: {
    directory?: SsoDirectoryWithApp | null;
    input: {
      internalDirectoryId: string;
      method: string;
      resourceType: string;
      resourceId?: string;
      query?: Record<string, any>;
      requestBody?: any;
      responseBody?: any;
      statusCode: number;
      success: boolean;
      durationMs: number;
      eventNames: string[];
      errorMessage?: string;
    };
  }) {
    try {
      await db.ssoScimOperation.create({
        data: {
          ...getId('ssoScimOperation'),
          directoryOid: d.directory?.oid,
          appOid: d.directory?.connection?.tenant?.appOid,
          internalDirectoryId: d.input.internalDirectoryId,
          method: d.input.method,
          resourceType: d.input.resourceType,
          resourceId: d.input.resourceId,
          query: d.input.query,
          requestBody: d.input.requestBody,
          responseBody: d.input.responseBody,
          statusCode: d.input.statusCode,
          success: d.input.success,
          durationMs: d.input.durationMs,
          eventNames: uniqueValues(d.input.eventNames),
          errorMessage: d.input.errorMessage
        }
      });
    } catch (error) {
      console.warn('Failed to record SCIM operation', error);
    }
  }

  async setDirectoryStatus(d: {
    tenant: SsoTenant;
    connection: SsoConnection;
    directory: SsoDirectory;
    status: SsoDirectoryStatus;
  }) {
    if (
      d.connection.tenantOid !== d.tenant.oid ||
      d.directory.connectionOid !== d.connection.oid
    ) {
      throw new ServiceError(notFoundError('sso.directory'));
    }

    if (d.status === 'disabled') {
      await db.ssoUserProfile.updateMany({
        where: {
          directories: { some: { directoryOid: d.directory.oid } }
        },
        data: { status: 'deprovisioned' }
      });

      await db.ssoUserProfile.updateMany({
        where: { ownerDirectoryOid: d.directory.oid },
        data: { ownerDirectoryOid: null }
      });
    }

    return await db.ssoDirectory.update({
      where: { oid: d.directory.oid },
      data: { status: d.status }
    });
  }

  async createSetup(d: { tenant: SsoTenant; input: { redirectUri: string } }) {
    return await db.ssoConnectionSetup.create({
      data: {
        ...getId('ssoConnectionSetup'),
        tenantOid: d.tenant.oid,
        clientSecret: await ID.generateId('ssoConnectionSetup_clientSecret'),
        redirectUri: d.input.redirectUri
      }
    });
  }

  async getSetupByClientSecret(d: { clientSecret: string }) {
    let setup = await db.ssoConnectionSetup.findUnique({
      where: { clientSecret: d.clientSecret },
      include: { tenant: true, connection: true }
    });
    if (!setup) throw new ServiceError(notFoundError('sso.setup'));
    return setup;
  }

  async createConnectionForSetup(d: {
    clientSecret: string;
    providerId: string;
    name: string;
    samlMetadata?: { type: 'xml'; payload: string } | { type: 'url'; url: string };
    oidcDiscoveryUrl?: string;
    oidcClientId?: string;
    oidcClientSecret?: string;
  }) {
    let setup = await this.getSetupByClientSecret({ clientSecret: d.clientSecret });

    if (setup.status === 'completed') {
      throw new ServiceError(badRequestError({ message: 'Setup already completed' }));
    }

    let connection: SsoConnection;

    if (d.samlMetadata) {
      connection = await this.createSamlConnection({
        tenant: setup.tenant,
        input: {
          name: d.name,
          provider: d.providerId,
          metadata: {},
          samlMetadata: d.samlMetadata
        }
      });
    } else if (d.oidcDiscoveryUrl && d.oidcClientId && d.oidcClientSecret) {
      connection = await this.createOidcConnection({
        tenant: setup.tenant,
        input: {
          name: d.name,
          provider: d.providerId,
          metadata: {},
          oidcDiscoveryUrl: d.oidcDiscoveryUrl,
          clientId: d.oidcClientId,
          clientSecret: d.oidcClientSecret
        }
      });
    } else {
      throw new ServiceError(badRequestError({ message: 'Invalid connection configuration' }));
    }

    await db.ssoConnectionSetup.update({
      where: { oid: setup.oid },
      data: { connectionOid: connection.oid, status: 'completed' }
    });

    return { setup, tenant: setup.tenant, connection };
  }

  async createAuth(d: {
    tenant: SsoTenant;
    input: {
      redirectUri: string;
      email?: string;
      state: string;
    };
  }) {
    return await db.ssoAuth.create({
      data: {
        ...getId('ssoAuth'),
        clientSecret: await ID.generateId('ssoAuth_clientSecret'),
        tenantOid: d.tenant.oid,
        state: d.input.state,
        redirectUri: d.input.redirectUri,
        email: d.input.email ?? null
      }
    });
  }

  async getAuthByClientSecret(d: { clientSecret: string }) {
    let auth = await db.ssoAuth.findUnique({
      where: { clientSecret: d.clientSecret },
      include: { tenant: true }
    });
    if (!auth) throw new ServiceError(notFoundError('sso.auth'));
    return auth;
  }

  async completeAuth(d: { authId: string }) {
    let auth = await db.ssoAuth.findUnique({
      where: { id: d.authId },
      include: {
        tenant: true,
        connection: true,
        userProfile: true,
        user: true
      }
    });

    if (
      !auth ||
      auth.status != 'completed' ||
      !auth.user ||
      !auth.connection ||
      !auth.userProfile
    ) {
      throw new ServiceError(notFoundError('sso.auth'));
    }

    await db.ssoAuth.delete({ where: { oid: auth.oid } });

    return {
      auth,
      user: auth.user,
      tenant: auth.tenant,
      connection: auth.connection,
      userProfile: auth.userProfile
    };
  }

  async upsertUser(d: {
    tenant: SsoTenant;
    email: string;
    firstName: string;
    lastName: string;
  }) {
    let existing = await db.ssoUser.findFirst({
      where: { tenantOid: d.tenant.oid, email: d.email }
    });

    if (existing) {
      return await db.ssoUser.update({
        where: { oid: existing.oid },
        data: {
          status: 'active',
          firstName: d.firstName,
          lastName: d.lastName
        }
      });
    }

    return await db.ssoUser.create({
      data: {
        ...getId('ssoUser'),
        status: 'active',
        tenantOid: d.tenant.oid,
        email: d.email,
        firstName: d.firstName,
        lastName: d.lastName
      }
    });
  }

  async upsertUserProfile(d: {
    tenant: SsoTenant;
    connection: SsoConnection;
    user: SsoUser;
    updateMemberships?: boolean;
    enqueueReconciliation?: boolean;
    data: {
      email: string;
      uid: string;
      uidHash: string;
      sub?: string;
      firstName: string;
      lastName: string;
      roles: string[];
      groups: string[];
      raw: any;
    };
  }) {
    let existing = await db.ssoUserProfile.findFirst({
      where: {
        tenantOid: d.tenant.oid,
        userOid: d.user.oid,
        connectionOid: d.connection.oid,
        uidHash: d.data.uidHash
      }
    });

    if (existing) {
      let shouldUpdateMemberships = d.updateMemberships ?? !existing.ownerDirectoryOid;

      let profile = await db.ssoUserProfile.update({
        where: { oid: existing.oid },
        data: {
          status: 'active',
          email: d.data.email,
          uid: d.data.uid,
          sub: d.data.sub ?? null,
          firstName: d.data.firstName,
          lastName: d.data.lastName,
          roles: shouldUpdateMemberships ? d.data.roles : undefined,
          groups: shouldUpdateMemberships ? d.data.groups : undefined,
          isGroupRoleMemberReconciled: shouldUpdateMemberships ? true : undefined,
          raw: d.data.raw
        }
      });

      if (shouldUpdateMemberships) {
        await this.replaceUserProfileGroups({
          connection: d.connection,
          userProfile: profile,
          groups: d.data.groups
        });
        await this.replaceUserProfileRoles({
          connection: d.connection,
          userProfile: profile,
          roles: d.data.roles
        });
      }

      await this.setSsoUserOwnerProfile({
        user: d.user,
        profile,
        enqueueReconciliation: d.enqueueReconciliation
      });

      return profile;
    }

    let profile = await db.ssoUserProfile.create({
      data: {
        ...getId('ssoUserProfile'),
        status: 'active',
        tenantOid: d.tenant.oid,
        connectionOid: d.connection.oid,
        userOid: d.user.oid,
        email: d.data.email,
        uid: d.data.uid,
        uidHash: d.data.uidHash,
        sub: d.data.sub ?? null,
        firstName: d.data.firstName,
        lastName: d.data.lastName,
        roles: d.data.roles,
        groups: d.data.groups,
        isGroupRoleMemberReconciled: d.updateMemberships ?? true,
        raw: d.data.raw
      }
    });

    if (d.updateMemberships ?? true) {
      await this.replaceUserProfileGroups({
        connection: d.connection,
        userProfile: profile,
        groups: d.data.groups
      });
      await this.replaceUserProfileRoles({
        connection: d.connection,
        userProfile: profile,
        roles: d.data.roles
      });
    }

    await this.setSsoUserOwnerProfile({
      user: d.user,
      profile,
      enqueueReconciliation: d.enqueueReconciliation
    });

    return profile;
  }

  async upsertRootGroup(d: {
    tenant: SsoTenant | { oid: bigint };
    value: string;
    displayName?: string | null;
    metadata?: Record<string, any>;
  }) {
    let value = d.value;
    if (!value)
      throw new ServiceError(badRequestError({ message: 'Group value is required' }));

    let existing = await db.ssoGroup.findFirst({
      where: { tenantOid: d.tenant.oid, value }
    });

    if (existing) {
      return await db.ssoGroup.update({
        where: { oid: existing.oid },
        data: {
          displayName: d.displayName ?? undefined,
          metadata: d.metadata ?? undefined
        }
      });
    }

    try {
      return await db.ssoGroup.create({
        data: {
          ...getId('ssoGroup'),
          tenantOid: d.tenant.oid,
          value,
          displayName: d.displayName ?? null,
          metadata: d.metadata ?? undefined
        }
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;

      let group = await db.ssoGroup.findFirst({
        where: { tenantOid: d.tenant.oid, value }
      });
      if (!group) throw error;
      return group;
    }
  }

  async upsertRootRole(d: {
    tenant: SsoTenant | { oid: bigint };
    value: string;
    displayName?: string | null;
    metadata?: Record<string, any>;
  }) {
    let value = d.value;
    if (!value) throw new ServiceError(badRequestError({ message: 'Role value is required' }));

    let existing = await db.ssoRole.findFirst({
      where: { tenantOid: d.tenant.oid, value }
    });

    if (existing) {
      return await db.ssoRole.update({
        where: { oid: existing.oid },
        data: {
          displayName: d.displayName ?? undefined,
          metadata: d.metadata ?? undefined
        }
      });
    }

    try {
      return await db.ssoRole.create({
        data: {
          ...getId('ssoRole'),
          tenantOid: d.tenant.oid,
          value,
          displayName: d.displayName ?? null,
          metadata: d.metadata ?? undefined
        }
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;

      let role = await db.ssoRole.findFirst({
        where: { tenantOid: d.tenant.oid, value }
      });
      if (!role) throw error;
      return role;
    }
  }

  async upsertGroup(d: {
    connection: SsoConnection;
    value: string;
    displayName?: string | null;
    metadata?: Record<string, any>;
  }) {
    let value = d.value;
    if (!value)
      throw new ServiceError(badRequestError({ message: 'Group value is required' }));

    let rootGroup = await this.upsertRootGroup({
      tenant: { oid: d.connection.tenantOid },
      value,
      displayName: d.displayName,
      metadata: d.metadata
    });

    let existing = await db.ssoConnectionGroup.findFirst({
      where: { connectionOid: d.connection.oid, value }
    });

    if (existing) {
      return await db.ssoConnectionGroup.update({
        where: { oid: existing.oid },
        data: {
          rootGroupOid: rootGroup.oid,
          displayName: d.displayName ?? undefined,
          metadata: d.metadata ?? undefined
        }
      });
    }

    try {
      return await db.ssoConnectionGroup.create({
        data: {
          ...getId('ssoConnectionGroup'),
          connectionOid: d.connection.oid,
          rootGroupOid: rootGroup.oid,
          value,
          displayName: d.displayName ?? null,
          metadata: d.metadata ?? undefined
        }
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;

      let group = await db.ssoConnectionGroup.findFirst({
        where: { connectionOid: d.connection.oid, value }
      });
      if (!group) throw error;
      if (group.rootGroupOid === rootGroup.oid) return group;

      return await db.ssoConnectionGroup.update({
        where: { oid: group.oid },
        data: { rootGroupOid: rootGroup.oid }
      });
    }
  }

  async upsertRole(d: {
    connection: SsoConnection;
    value: string;
    displayName?: string | null;
    metadata?: Record<string, any>;
  }) {
    let value = d.value;
    if (!value) throw new ServiceError(badRequestError({ message: 'Role value is required' }));

    let rootRole = await this.upsertRootRole({
      tenant: { oid: d.connection.tenantOid },
      value,
      displayName: d.displayName,
      metadata: d.metadata
    });

    let existing = await db.ssoConnectionRole.findFirst({
      where: { connectionOid: d.connection.oid, value }
    });

    if (existing) {
      return await db.ssoConnectionRole.update({
        where: { oid: existing.oid },
        data: {
          rootRoleOid: rootRole.oid,
          displayName: d.displayName ?? undefined,
          metadata: d.metadata ?? undefined
        }
      });
    }

    try {
      return await db.ssoConnectionRole.create({
        data: {
          ...getId('ssoConnectionRole'),
          connectionOid: d.connection.oid,
          rootRoleOid: rootRole.oid,
          value,
          displayName: d.displayName ?? null,
          metadata: d.metadata ?? undefined
        }
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;

      let role = await db.ssoConnectionRole.findFirst({
        where: { connectionOid: d.connection.oid, value }
      });
      if (!role) throw error;
      if (role.rootRoleOid === rootRole.oid) return role;

      return await db.ssoConnectionRole.update({
        where: { oid: role.oid },
        data: { rootRoleOid: rootRole.oid }
      });
    }
  }

  async replaceUserProfileGroups(d: {
    connection: SsoConnection;
    userProfile: SsoUserProfile;
    groups: string[];
  }) {
    let groups = uniqueValues(d.groups);

    await withTransaction(async tdb => {
      await tdb.ssoUserProfileGroup.deleteMany({
        where: { userProfileOid: d.userProfile.oid }
      });

      for (let value of groups) {
        let group = await this.upsertGroup({
          connection: d.connection,
          value,
          displayName: value
        });

        try {
          await tdb.ssoUserProfileGroup.create({
            data: {
              ...getId('ssoUserProfileGroup'),
              userProfileOid: d.userProfile.oid,
              groupOid: group.oid
            }
          });
        } catch (error) {
          if (!isUniqueConstraintError(error)) throw error;
        }
      }
    });
  }

  async replaceUserProfileRoles(d: {
    connection: SsoConnection;
    userProfile: SsoUserProfile;
    roles: string[];
  }) {
    let roles = uniqueValues(d.roles);

    await withTransaction(async tdb => {
      await tdb.ssoUserProfileRole.deleteMany({
        where: { userProfileOid: d.userProfile.oid }
      });

      for (let value of roles) {
        let role = await this.upsertRole({
          connection: d.connection,
          value,
          displayName: value
        });

        try {
          await tdb.ssoUserProfileRole.create({
            data: {
              ...getId('ssoUserProfileRole'),
              userProfileOid: d.userProfile.oid,
              roleOid: role.oid
            }
          });
        } catch (error) {
          if (!isUniqueConstraintError(error)) throw error;
        }
      }
    });
  }

  async setUserProfileGroupMembership(d: {
    connection: SsoConnection;
    userProfile: SsoUserProfile;
    groupValue: string;
    member: boolean;
  }) {
    let group = await this.upsertGroup({
      connection: d.connection,
      value: d.groupValue,
      displayName: d.groupValue
    });

    if (d.member) {
      let existing = await db.ssoUserProfileGroup.findFirst({
        where: {
          userProfileOid: d.userProfile.oid,
          groupOid: group.oid
        }
      });
      if (existing) return existing;

      try {
        return await db.ssoUserProfileGroup.create({
          data: {
            ...getId('ssoUserProfileGroup'),
            userProfileOid: d.userProfile.oid,
            groupOid: group.oid
          }
        });
      } catch (error) {
        if (!isUniqueConstraintError(error)) throw error;

        return await db.ssoUserProfileGroup.findFirst({
          where: {
            userProfileOid: d.userProfile.oid,
            groupOid: group.oid
          }
        });
      }
    }

    await db.ssoUserProfileGroup.deleteMany({
      where: {
        userProfileOid: d.userProfile.oid,
        groupOid: group.oid
      }
    });
  }

  async linkDirectoryUserProfile(d: {
    directory: SsoDirectory;
    userProfile: SsoUserProfile;
    externalId?: string | null;
    raw?: any;
  }) {
    let existing = await db.ssoDirectoryUserProfile.findFirst({
      where: {
        directoryOid: d.directory.oid,
        userProfileOid: d.userProfile.oid
      }
    });

    if (!existing && d.externalId) {
      existing = await db.ssoDirectoryUserProfile.findFirst({
        where: {
          directoryOid: d.directory.oid,
          externalId: d.externalId
        }
      });
    }

    if (existing) {
      return await db.ssoDirectoryUserProfile.update({
        where: { oid: existing.oid },
        data: {
          userProfileOid: d.userProfile.oid,
          externalId: d.externalId ?? existing.externalId,
          raw: d.raw ?? undefined,
          lastSeenAt: new Date(),
          deprovisionedAt: null
        }
      });
    }

    try {
      return await db.ssoDirectoryUserProfile.create({
        data: {
          ...getId('ssoDirectoryUserProfile'),
          directoryOid: d.directory.oid,
          userProfileOid: d.userProfile.oid,
          externalId: d.externalId ?? null,
          raw: d.raw ?? undefined,
          lastSeenAt: new Date()
        }
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;

      let link = await db.ssoDirectoryUserProfile.findFirst({
        where: {
          directoryOid: d.directory.oid,
          OR: [
            { userProfileOid: d.userProfile.oid },
            ...(d.externalId ? [{ externalId: d.externalId }] : [])
          ]
        }
      });
      if (!link) throw error;

      return await db.ssoDirectoryUserProfile.update({
        where: { oid: link.oid },
        data: {
          userProfileOid: d.userProfile.oid,
          externalId: d.externalId ?? link.externalId,
          raw: d.raw ?? undefined,
          lastSeenAt: new Date(),
          deprovisionedAt: null
        }
      });
    }
  }

  async setUserProfileOwnerDirectory(d: {
    userProfile: SsoUserProfile;
    directory: SsoDirectory;
  }) {
    return await db.ssoUserProfile.update({
      where: { oid: d.userProfile.oid },
      data: { ownerDirectoryOid: d.directory.oid }
    });
  }

  private async upsertUserProfileFromDirectoryUser(d: {
    directory: SsoDirectory;
    userPayload: User;
    syncRoles: boolean;
    enqueueReconciliation?: boolean;
  }) {
    let directory = await db.ssoDirectory.findUnique({
      where: { oid: d.directory.oid },
      include: { connection: { include: { tenant: true } } }
    });
    if (!directory) throw new ServiceError(notFoundError('sso.directory'));

    let user = await this.upsertUser({
      tenant: directory.connection.tenant,
      email: d.userPayload.email,
      firstName: d.userPayload.first_name,
      lastName: d.userPayload.last_name
    });

    let linkedProfile = await db.ssoDirectoryUserProfile.findFirst({
      where: {
        directoryOid: directory.oid,
        externalId: d.userPayload.id
      },
      include: { userProfile: true }
    });

    let profile =
      linkedProfile?.userProfile ??
      (await db.ssoUserProfile.findFirst({
        where: {
          tenantOid: directory.connection.tenantOid,
          connectionOid: directory.connectionOid,
          userOid: user.oid
        }
      }));

    if (!profile) {
      profile = await this.upsertUserProfile({
        tenant: directory.connection.tenant,
        connection: directory.connection,
        user,
        updateMemberships: false,
        enqueueReconciliation: false,
        data: {
          email: d.userPayload.email,
          uid: d.userPayload.id,
          uidHash: hashUid(d.userPayload.id),
          firstName: d.userPayload.first_name,
          lastName: d.userPayload.last_name,
          roles: [],
          groups: [],
          raw: d.userPayload.raw ?? d.userPayload
        }
      });
    } else {
      profile = await db.ssoUserProfile.update({
        where: { oid: profile.oid },
        data: {
          status: d.userPayload.active ? 'active' : 'deprovisioned',
          email: d.userPayload.email,
          firstName: d.userPayload.first_name,
          lastName: d.userPayload.last_name,
          raw: d.userPayload.raw ?? d.userPayload
        }
      });
    }

    await this.linkDirectoryUserProfile({
      directory,
      userProfile: profile,
      externalId: d.userPayload.id,
      raw: d.userPayload.raw ?? d.userPayload
    });

    profile = await db.ssoUserProfile.update({
      where: { oid: profile.oid },
      data: {
        ownerDirectoryOid: directory.oid,
        status: d.userPayload.active ? 'active' : 'deprovisioned'
      }
    });

    if (d.syncRoles) {
      let roles = d.userPayload.roles ?? [];
      await this.replaceUserProfileRoles({
        connection: directory.connection,
        userProfile: profile,
        roles
      });

      profile = await db.ssoUserProfile.update({
        where: { oid: profile.oid },
        data: {
          roles,
          isGroupRoleMemberReconciled: true
        }
      });
    }

    await this.setSsoUserOwnerProfile({
      user,
      profile,
      enqueueReconciliation: d.enqueueReconciliation
    });

    return { directory, user, profile };
  }

  async handleDirectorySyncEvent(d: { directory: SsoDirectory; event: DirectorySyncEvent }) {
    let eventName = d.event.event;

    if (eventName === 'user.created' || eventName === 'user.updated') {
      return await this.syncUserFromDirectoryEvent(d);
    }

    if (eventName === 'user.deleted') {
      return await this.deleteUserFromDirectoryEvent(d);
    }

    if (eventName === 'group.created' || eventName === 'group.updated') {
      return await this.syncGroupFromDirectoryEvent(d);
    }

    if (eventName === 'group.deleted') {
      return await this.deleteGroupFromDirectoryEvent(d);
    }

    if (eventName === 'group.user_added' || eventName === 'group.user_removed') {
      return await this.syncGroupMembershipFromDirectoryEvent({
        ...d,
        member: eventName === 'group.user_added'
      });
    }
  }

  async syncUserFromDirectoryEvent(d: { directory: SsoDirectory; event: DirectorySyncEvent }) {
    let { profile } = await this.upsertUserProfileFromDirectoryUser({
      directory: d.directory,
      userPayload: d.event.data as User,
      syncRoles: true
    });

    return profile;
  }

  async syncGroupFromDirectoryEvent(d: {
    directory: SsoDirectory;
    event: DirectorySyncEvent;
  }) {
    let directory = await db.ssoDirectory.findUnique({
      where: { oid: d.directory.oid },
      include: { connection: true }
    });
    if (!directory) throw new ServiceError(notFoundError('sso.directory'));

    let groupPayload = d.event.data as Group;

    return await this.upsertGroup({
      connection: directory.connection,
      value: groupPayload.id,
      displayName: groupPayload.name,
      metadata: {
        raw: groupPayload.raw ?? groupPayload
      }
    });
  }

  async syncGroupMembershipFromDirectoryEvent(d: {
    directory: SsoDirectory;
    event: DirectorySyncEvent;
    member: boolean;
  }) {
    let directory = await db.ssoDirectory.findUnique({
      where: { oid: d.directory.oid },
      include: { connection: true }
    });
    if (!directory) throw new ServiceError(notFoundError('sso.directory'));

    let userPayload = d.event.data as UserWithGroup;
    let { user, profile } = await this.upsertUserProfileFromDirectoryUser({
      directory,
      userPayload,
      syncRoles: true,
      enqueueReconciliation: false
    });

    await this.upsertGroup({
      connection: directory.connection,
      value: userPayload.group.id,
      displayName: userPayload.group.name,
      metadata: {
        raw: userPayload.group.raw ?? userPayload.group
      }
    });

    await this.setUserProfileGroupMembership({
      connection: directory.connection,
      userProfile: profile,
      groupValue: userPayload.group.id,
      member: d.member
    });

    let groups = d.member
      ? uniqueValues([...profile.groups, userPayload.group.id])
      : profile.groups.filter(group => group !== userPayload.group.id);

    let updatedProfile = await db.ssoUserProfile.update({
      where: { oid: profile.oid },
      data: {
        groups,
        isGroupRoleMemberReconciled: true
      }
    });

    await this.enqueueSsoUserReconciliation(user);

    return updatedProfile;
  }

  async deleteUserFromDirectoryEvent(d: {
    directory: SsoDirectory;
    event: DirectorySyncEvent;
  }) {
    let externalId = d.event.data.id;
    if (!externalId) return;

    let link = await db.ssoDirectoryUserProfile.findFirst({
      where: { directoryOid: d.directory.oid, externalId },
      include: { userProfile: true }
    });
    if (!link) return;

    await db.ssoDirectoryUserProfile.update({
      where: { oid: link.oid },
      data: { deprovisionedAt: new Date() }
    });

    if (link.userProfile.ownerDirectoryOid === d.directory.oid) {
      await db.ssoUserProfile.update({
        where: { oid: link.userProfile.oid },
        data: {
          ownerDirectoryOid: null,
          status: 'deprovisioned',
          groups: [],
          roles: []
        }
      });
      await this.replaceUserProfileGroups({
        connection: await db.ssoConnection.findUniqueOrThrow({
          where: { oid: d.directory.connectionOid }
        }),
        userProfile: link.userProfile,
        groups: []
      });
      await this.replaceUserProfileRoles({
        connection: await db.ssoConnection.findUniqueOrThrow({
          where: { oid: d.directory.connectionOid }
        }),
        userProfile: link.userProfile,
        roles: []
      });

      let user = await db.ssoUser.findUnique({
        where: { oid: link.userProfile.userOid }
      });
      if (user) await this.enqueueSsoUserReconciliation(user);
    }
  }

  async deleteGroupFromDirectoryEvent(d: {
    directory: SsoDirectory;
    event: DirectorySyncEvent;
  }) {
    let directory = await db.ssoDirectory.findUnique({
      where: { oid: d.directory.oid },
      include: { connection: true }
    });
    if (!directory) throw new ServiceError(notFoundError('sso.directory'));

    let groupPayload = d.event.data as Group;

    let group = await db.ssoConnectionGroup.findFirst({
      where: {
        connectionOid: directory.connectionOid,
        value: groupPayload.id
      }
    });
    if (!group) return;

    await db.ssoUserProfileGroup.deleteMany({ where: { groupOid: group.oid } });
  }
}

export let ssoService = new SsoServiceImpl();
