import { badRequestError, conflictError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { randomBytes, timingSafeEqual } from 'crypto';
import { addMinutes } from 'date-fns';
import { Prisma } from '../../../prisma/generated/client';
import type {
  App,
  AresInstance,
  SsoConnection,
  SsoExportedDelegation,
  SsoImportedDelegation,
  SsoTenant,
  SsoUserProfile
} from '../../../prisma/generated/client';
import { db, type TransactionDB, withTransaction } from '../../db';
import { env } from '../../env';
import { getId, ID } from '../../id';
import {
  assertDelegationAuthorizationGrant,
  getExportedDelegationRedirectUri,
  hashDelegationSecret,
  normalizeDelegationAuthorizationEndpoint,
  pickLatestExportedDelegation
} from '../../lib/ssoDelegationProtocol';

export type DelegationDescriptor = {
  id: string;
  tenantId: string;
  clientId: string;
  clientSecret: string;
  instance: {
    id: string;
    authorizationUrl: string;
    tokenUrl: string;
  };
};

export type DelegationSnapshot = {
  active: true;
  type: 'metadata' | 'identity';
  delegation: {
    id: string;
    clientId: string;
  };
  instance: {
    id: string;
    authorizationUrl: string;
    tokenUrl: string;
  };
  tenant: {
    id: string;
    name: string;
    status: 'completed';
    externalId: string | null;
    metadata: Record<string, any> | null;
    hideInUI: boolean;
  };
  connections: {
    id: string;
    status: 'active' | 'disabled';
    providerType: 'saml' | 'oidc';
    providerName: string | null;
    name: string;
    metadata: Record<string, any> | null;
  }[];
  connection?: {
    id: string;
    status: 'active' | 'disabled';
    providerType: 'saml' | 'oidc';
    providerName: string | null;
    name: string;
    metadata: Record<string, any> | null;
  };
  userProfile?: {
    email: string;
    uid: string;
    uidHash: string;
    sub: string | null;
    firstName: string;
    lastName: string;
    roles: string[];
    groups: string[];
    raw: any;
  };
};

let createOpaqueSecret = () => randomBytes(48).toString('base64url');

let presentConnectionSnapshot = (connection: SsoConnection) => ({
  id: connection.id,
  status: connection.status,
  providerType: connection.providerType,
  providerName: connection.providerName,
  name: connection.name,
  metadata: (connection.metadata as Record<string, any> | null) ?? null
});

let localInstance: AresInstance | null = null;

class SsoDelegationServiceImpl {
  async ensureLocalInstance() {
    if (localInstance) return localInstance;

    let res = await db.aresInstance.upsert({
      where: { singletonKey: 'local' },
      create: {
        ...getId('aresInstance'),
        singletonKey: 'local'
      },
      update: {}
    });

    localInstance = res;

    return res;
  }

  getAuthorizationUrl(d: { clientId: string; endpoint?: string }) {
    let url = new URL(
      d.endpoint ?? `${env.service.ARES_SSO_URL}/metorial-ares/sso-delegation/authorize`
    );
    url.searchParams.set('client_id', d.clientId);
    url.searchParams.set('response_type', 'urn:metorial.com:ares:sso-delegation');
    return url.toString();
  }

  async createExport(d: { tenant: SsoTenant; identifier: string }) {
    if (d.tenant.status !== 'completed' || d.tenant.importedDelegationOid) {
      throw new ServiceError(
        conflictError({ message: 'Only completed local SSO tenants can be delegated' })
      );
    }

    let instance = await this.ensureLocalInstance();
    let delegation = await db.ssoExportedDelegation.upsert({
      where: {
        tenantOid_identifier: {
          tenantOid: d.tenant.oid,
          identifier: d.identifier
        }
      },
      create: {
        ...getId('ssoExportedDelegation'),
        tenantOid: d.tenant.oid,
        instanceOid: instance.oid,
        identifier: d.identifier,
        clientId: await ID.generateId('ssoExportedDelegation_clientId'),
        clientSecret: await ID.generateId('ssoExportedDelegation_clientSecret')
      },
      update: {},
      include: { tenant: true, instance: true }
    });

    return delegation;
  }

  presentDescriptor(
    delegation: SsoExportedDelegation & {
      tenant: SsoTenant;
      instance: { id: string };
    }
  ): DelegationDescriptor {
    return {
      id: delegation.id,
      tenantId: delegation.tenant.id,
      clientId: delegation.clientId,
      clientSecret: delegation.clientSecret,
      instance: {
        id: delegation.instance.id,
        authorizationUrl: this.getAuthorizationUrl({
          clientId: delegation.clientId
        }),
        tokenUrl: `${env.service.ARES_SSO_URL}/metorial-ares/sso-delegation/token`
      }
    };
  }

  async authenticateExport(d: { clientId: string; clientSecret: string }) {
    let delegation = await db.ssoExportedDelegation.findUnique({
      where: { clientId: d.clientId },
      include: {
        tenant: { include: { account: true } },
        instance: true
      }
    });
    if (!delegation) throw new ServiceError(notFoundError('sso.delegation'));

    let expected = Buffer.from(delegation.clientSecret);
    let actual = Buffer.from(d.clientSecret);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      throw new ServiceError(notFoundError('sso.delegation'));
    }
    return delegation;
  }

  async getExportByClientId(d: { clientId: string }) {
    let delegation = await db.ssoExportedDelegation.findUnique({
      where: { clientId: d.clientId },
      include: {
        tenant: { include: { account: true } },
        instance: true
      }
    });
    if (!delegation || delegation.tenant.status !== 'completed') {
      throw new ServiceError(notFoundError('sso.delegation'));
    }
    return delegation;
  }

  async createToken(d: {
    delegation: SsoExportedDelegation;
    type: 'identity' | 'metadata';
    connectionOid?: bigint;
    userProfileOid?: bigint;
  }) {
    let token = createOpaqueSecret();
    await db.ssoDelegationToken.create({
      data: {
        ...getId('ssoDelegationToken'),
        type: d.type,
        tokenHash: hashDelegationSecret(token),
        exportedDelegationOid: d.delegation.oid,
        connectionOid: d.connectionOid,
        userProfileOid: d.userProfileOid,
        expiresAt: addMinutes(new Date(), 5)
      }
    });
    return token;
  }

  async storeExportRedirectUri(d: {
    delegation: SsoExportedDelegation;
    redirectUri: string;
  }) {
    if (d.delegation.redirectUri === d.redirectUri) return;
    await db.ssoExportedDelegation.update({
      where: { oid: d.delegation.oid },
      data: { redirectUri: d.redirectUri }
    });
  }

  async exchangeAuthorizationCode(d: {
    delegation: SsoExportedDelegation;
    code: string;
    redirectUri: string;
    codeVerifier?: string;
  }) {
    let code = await db.ssoDelegationAuthorizationCode.findUnique({
      where: { codeHash: hashDelegationSecret(d.code) }
    });
    if (
      !code ||
      code.exportedDelegationOid !== d.delegation.oid ||
      code.expiresAt <= new Date() ||
      code.consumedAt
    ) {
      throw new ServiceError(badRequestError({ message: 'Invalid authorization code' }));
    }

    try {
      assertDelegationAuthorizationGrant({
        storedRedirectUri: code.redirectUri,
        presentedRedirectUri: d.redirectUri,
        codeChallenge: code.codeChallenge,
        codeVerifier: d.codeVerifier
      });
    } catch (error) {
      throw new ServiceError(
        badRequestError({
          message:
            error instanceof Error && error.message === 'Invalid PKCE verifier'
              ? 'Invalid PKCE verifier'
              : 'Invalid authorization code'
        })
      );
    }

    let consumed = await db.ssoDelegationAuthorizationCode.updateMany({
      where: { oid: code.oid, consumedAt: null, expiresAt: { gt: new Date() } },
      data: { consumedAt: new Date() }
    });
    if (consumed.count !== 1) {
      throw new ServiceError(badRequestError({ message: 'Authorization code was consumed' }));
    }

    return await this.createToken({
      delegation: d.delegation,
      type: 'identity',
      connectionOid: code.connectionOid,
      userProfileOid: code.userProfileOid
    });
  }

  async introspectToken(d: {
    delegation: SsoExportedDelegation & { tenant?: SsoTenant; instance?: { id: string } };
    token: string;
  }): Promise<DelegationSnapshot | { active: false }> {
    let token = await db.ssoDelegationToken.findUnique({
      where: { tokenHash: hashDelegationSecret(d.token) },
      include: {
        exportedDelegation: {
          include: {
            tenant: { include: { connections: true } },
            instance: true
          }
        },
        connection: true,
        userProfile: true
      }
    });
    if (
      !token ||
      token.exportedDelegationOid !== d.delegation.oid ||
      token.expiresAt <= new Date() ||
      token.revokedAt ||
      token.exportedDelegation.tenant.status !== 'completed'
    ) {
      return { active: false };
    }

    let exported = token.exportedDelegation;
    let snapshot: DelegationSnapshot = {
      active: true,
      type: token.type,
      delegation: {
        id: exported.id,
        clientId: exported.clientId
      },
      instance: {
        id: exported.instance.id,
        authorizationUrl: this.getAuthorizationUrl({
          clientId: exported.clientId
        }),
        tokenUrl: `${env.service.ARES_SSO_URL}/metorial-ares/sso-delegation/token`
      },
      tenant: {
        id: exported.tenant.id,
        name: exported.tenant.name,
        status: 'completed',
        externalId: exported.tenant.externalId,
        metadata: (exported.tenant.metadata as Record<string, any> | null) ?? null,
        hideInUI: exported.tenant.hideInUI
      },
      connections: exported.tenant.connections.map(presentConnectionSnapshot)
    };

    if (token.type === 'identity' && token.connection && token.userProfile) {
      snapshot.connection = presentConnectionSnapshot(token.connection);
      snapshot.userProfile = {
        email: token.userProfile.email,
        uid: token.userProfile.uid,
        uidHash: token.userProfile.uidHash,
        sub: token.userProfile.sub,
        firstName: token.userProfile.firstName,
        lastName: token.userProfile.lastName,
        roles: token.userProfile.roles,
        groups: token.userProfile.groups,
        raw: token.userProfile.raw
      };
    }
    return snapshot;
  }

  async completeExportAuthorization(d: { authId: string; tenantId: string }) {
    let request = await db.ssoDelegationAuthRequest.findFirst({
      where: {
        ssoAuth: { id: d.authId },
        expiresAt: { gt: new Date() }
      },
      include: { exportedDelegation: true }
    });
    if (!request) throw new ServiceError(notFoundError('sso.delegation_auth'));

    let auth = await db.ssoAuth.findUnique({
      where: { id: d.authId },
      include: { tenant: true, connection: true, userProfile: true }
    });
    if (
      !auth ||
      auth.tenant.id !== d.tenantId ||
      auth.tenantOid !== request.exportedDelegation.tenantOid ||
      auth.status !== 'completed' ||
      !auth.connection ||
      !auth.userProfile
    ) {
      throw new ServiceError(notFoundError('sso.delegation_auth'));
    }

    let code = createOpaqueSecret();
    await withTransaction(async tdb => {
      await tdb.ssoDelegationAuthorizationCode.create({
        data: {
          ...getId('ssoDelegationAuthorizationCode'),
          codeHash: hashDelegationSecret(code),
          redirectUri: request.redirectUri,
          codeChallenge: request.codeChallenge,
          exportedDelegationOid: request.exportedDelegationOid,
          connectionOid: auth.connectionOid!,
          userProfileOid: auth.userProfileOid!,
          expiresAt: new Date(Date.now() + 60_000)
        }
      });
      await tdb.ssoAuth.delete({ where: { oid: auth.oid } });
    });

    return { code, state: request.state, redirectUri: request.redirectUri };
  }

  async completeIdpInitiatedExport(d: {
    tenant: SsoTenant;
    connection: SsoConnection;
    userProfile: SsoUserProfile;
  }) {
    let exportedDelegations = await db.ssoExportedDelegation.findMany({
      where: { tenantOid: d.tenant.oid }
    });
    let delegation = pickLatestExportedDelegation(exportedDelegations);
    if (!delegation) throw new ServiceError(notFoundError('sso.delegation'));

    let redirectUri = getExportedDelegationRedirectUri(delegation.redirectUri);
    let code = createOpaqueSecret();
    await db.ssoDelegationAuthorizationCode.create({
      data: {
        ...getId('ssoDelegationAuthorizationCode'),
        codeHash: hashDelegationSecret(code),
        redirectUri,
        codeChallenge: null,
        exportedDelegationOid: delegation.oid,
        connectionOid: d.connection.oid,
        userProfileOid: d.userProfile.oid,
        expiresAt: new Date(Date.now() + 60_000)
      }
    });

    return { code, redirectUri, clientId: delegation.clientId };
  }

  async storeImport(d: {
    app: App;
    descriptor: DelegationDescriptor;
    snapshot: DelegationSnapshot;
  }) {
    if (
      d.snapshot.delegation.id !== d.descriptor.id ||
      d.snapshot.delegation.clientId !== d.descriptor.clientId ||
      d.snapshot.tenant.id !== d.descriptor.tenantId ||
      d.snapshot.instance.id !== d.descriptor.instance.id ||
      normalizeDelegationAuthorizationEndpoint(
        d.snapshot.instance.authorizationUrl
      ) !==
        normalizeDelegationAuthorizationEndpoint(
          d.descriptor.instance.authorizationUrl
        ) ||
      new URL(d.snapshot.instance.tokenUrl).toString() !==
        new URL(d.descriptor.instance.tokenUrl).toString()
    ) {
      throw new ServiceError(
        badRequestError({ message: 'Delegation introspection did not match descriptor' })
      );
    }

    let existing = await db.ssoImportedDelegation.findUnique({
      where: { clientId: d.descriptor.clientId }
    });
    if (existing && existing.appOid !== d.app.oid) {
      throw new ServiceError(
        conflictError({ message: 'An imported delegation cannot be moved to another app' })
      );
    }

    let localInstance = await this.ensureLocalInstance();
    let localExport =
      localInstance.id === d.descriptor.instance.id
        ? await db.ssoExportedDelegation.findUnique({
            where: { clientId: d.descriptor.clientId }
          })
        : null;

    return await withTransaction(async tdb => {
      let remoteInstance = await tdb.remoteAresInstance.upsert({
        where: { remoteId: d.descriptor.instance.id },
        create: {
          ...getId('remoteAresInstance'),
          remoteId: d.descriptor.instance.id,
          authorizationEndpointUrl: normalizeDelegationAuthorizationEndpoint(
            d.descriptor.instance.authorizationUrl
          ),
          tokenUrl: d.descriptor.instance.tokenUrl
        },
        update: {
          authorizationEndpointUrl: normalizeDelegationAuthorizationEndpoint(
            d.descriptor.instance.authorizationUrl
          ),
          tokenUrl: d.descriptor.instance.tokenUrl
        }
      });

      let imported = await tdb.ssoImportedDelegation.upsert({
        where: { clientId: d.descriptor.clientId },
        create: {
          ...getId('ssoImportedDelegation'),
          status: 'active',
          clientId: d.descriptor.clientId,
          clientSecret: d.descriptor.clientSecret,
          sourceDelegationId: d.descriptor.id,
          sourceTenantId: d.descriptor.tenantId,
          sourceExternalId: d.snapshot.tenant.externalId,
          remoteInstanceOid: remoteInstance.oid,
          appOid: d.app.oid,
          localExportedDelegationOid: localExport?.oid,
          lastSyncAttemptAt: new Date(),
          lastSyncedAt: new Date()
        },
        update: {
          status: 'active',
          clientSecret: d.descriptor.clientSecret,
          sourceDelegationId: d.descriptor.id,
          sourceTenantId: d.descriptor.tenantId,
          sourceExternalId: d.snapshot.tenant.externalId,
          remoteInstanceOid: remoteInstance.oid,
          localExportedDelegationOid: localExport?.oid ?? null,
          lastSyncAttemptAt: new Date(),
          lastSyncedAt: new Date(),
          syncFailureCount: 0,
          lastSyncError: null,
          disabledAt: null
        }
      });

      let tenant = await tdb.ssoTenant.findUnique({
        where: { importedDelegationOid: imported.oid }
      });
      if (!tenant) {
        tenant = await tdb.ssoTenant.create({
          data: {
            ...getId('ssoTenant'),
            clientId: await ID.generateId('ssoTenant_clientId'),
            appOid: d.app.oid,
            importedDelegationOid: imported.oid,
            name: d.snapshot.tenant.name,
            externalId: null,
            metadata: d.snapshot.tenant.metadata ?? undefined,
            hideInUI: d.snapshot.tenant.hideInUI,
            status: 'completed',
            enrollment: 'disabled'
          }
        });
      } else {
        tenant = await tdb.ssoTenant.update({
          where: { oid: tenant.oid },
          data: {
            name: d.snapshot.tenant.name,
            metadata: d.snapshot.tenant.metadata ?? Prisma.DbNull,
            hideInUI: d.snapshot.tenant.hideInUI,
            status: 'completed'
          }
        });
      }

      let activeSourceIds = d.snapshot.connections.map(connection => connection.id);
      for (let source of d.snapshot.connections) {
        await tdb.ssoConnection.upsert({
          where: {
            importedDelegationOid_sourceId: {
              importedDelegationOid: imported.oid,
              sourceId: source.id
            }
          },
          create: {
            ...getId('ssoConnection'),
            tenantOid: tenant.oid,
            importedDelegationOid: imported.oid,
            sourceId: source.id,
            status: source.status,
            providerType: source.providerType,
            providerName: source.providerName,
            name: source.name,
            metadata: source.metadata ?? undefined
          },
          update: {
            status: source.status,
            providerType: source.providerType,
            providerName: source.providerName,
            name: source.name,
            metadata: source.metadata ?? Prisma.DbNull
          }
        });
      }
      await tdb.ssoConnection.updateMany({
        where: {
          importedDelegationOid: imported.oid,
          sourceId: { notIn: activeSourceIds }
        },
        data: { status: 'disabled' }
      });

      return await tdb.ssoImportedDelegation.findUniqueOrThrow({
        where: { oid: imported.oid },
        include: {
          remoteInstance: true,
          tenant: true,
          connections: true,
          localExportedDelegation: true
        }
      });
    });
  }

  private async disableImportWithDb(
    tdb: TransactionDB,
    d: { imported: SsoImportedDelegation; reason: string }
  ) {
    let tenant = await tdb.ssoTenant.findUnique({
      where: { importedDelegationOid: d.imported.oid }
    });
    if (tenant) {
      await tdb.accountDomainSsoTenant.deleteMany({
        where: { tenantOid: tenant.oid }
      });
      await tdb.accountDomainSsoConnection.deleteMany({
        where: { connection: { tenantOid: tenant.oid } }
      });
      await tdb.ssoConnection.updateMany({
        where: { tenantOid: tenant.oid },
        data: { status: 'disabled' }
      });
      await tdb.ssoTenant.update({
        where: { oid: tenant.oid },
        data: {
          status: 'disabled',
          enrollment: 'disabled',
          accountOid: null
        }
      });
    }
    await tdb.ssoImportedDelegation.update({
      where: { oid: d.imported.oid },
      data: {
        status: 'disabled',
        disabledAt: new Date(),
        lastSyncAttemptAt: new Date(),
        lastSyncError: d.reason
      }
    });
  }

  async disableImport(d: { imported: SsoImportedDelegation; reason: string }) {
    await withTransaction(async tdb => {
      await this.disableImportWithDb(tdb, d);
    });
  }

  async recordSyncFailure(d: { imported: SsoImportedDelegation; error: unknown }) {
    await db.ssoImportedDelegation.update({
      where: { oid: d.imported.oid },
      data: {
        lastSyncAttemptAt: new Date(),
        syncFailureCount: { increment: 1 },
        lastSyncError: d.error instanceof Error ? d.error.message : String(d.error)
      }
    });
  }

  async getDelegation(d: { delegationId: string }) {
    if (d.delegationId.startsWith('sed_')) {
      let exported = await db.ssoExportedDelegation.findUnique({
        where: { id: d.delegationId },
        include: {
          tenant: { include: { connections: true } },
          instance: true
        }
      });
      if (!exported) throw new ServiceError(notFoundError('sso.delegation'));
      return { direction: 'exported' as const, delegation: exported };
    }

    let imported = await db.ssoImportedDelegation.findUnique({
      where: { id: d.delegationId },
      include: {
        app: true,
        tenant: true,
        connections: true,
        remoteInstance: true,
        localExportedDelegation: true
      }
    });
    if (!imported) throw new ServiceError(notFoundError('sso.delegation'));
    return { direction: 'imported' as const, delegation: imported };
  }

  async listDelegations(d: {
    directions?: ('imported' | 'exported')[];
    appId?: string;
    tenantId?: string;
    clientId?: string;
    instanceId?: string;
    identifier?: string;
    statuses?: ('active' | 'disabled')[];
  }) {
    let includeImported =
      (!d.directions?.length || d.directions.includes('imported')) &&
      !d.identifier;
    let includeExported =
      (!d.directions?.length || d.directions.includes('exported')) &&
      (!d.statuses?.length || d.statuses.includes('active'));

    let [imports, exports] = await Promise.all([
      includeImported
        ? db.ssoImportedDelegation.findMany({
            where: {
              app: d.appId ? { id: d.appId } : undefined,
              tenant: d.tenantId ? { id: d.tenantId } : undefined,
              clientId: d.clientId,
              remoteInstance: d.instanceId ? { remoteId: d.instanceId } : undefined,
              status: d.statuses?.length ? { in: d.statuses } : undefined
            },
            include: {
              app: true,
              tenant: true,
              connections: true,
              remoteInstance: true,
              localExportedDelegation: true
            }
          })
        : [],
      includeExported
        ? db.ssoExportedDelegation.findMany({
            where: {
              tenant: {
                id: d.tenantId,
                app: d.appId ? { id: d.appId } : undefined
              },
              clientId: d.clientId,
              identifier: d.identifier,
              instance: d.instanceId ? { id: d.instanceId } : undefined
            },
            include: {
              tenant: { include: { connections: true } },
              instance: true
            }
          })
        : []
    ]);

    return [
      ...imports.map(delegation => ({
        direction: 'imported' as const,
        delegation
      })),
      ...exports.map(delegation => ({
        direction: 'exported' as const,
        delegation
      }))
    ].sort((a, b) => a.delegation.id.localeCompare(b.delegation.id));
  }

  async deleteDelegation(d: { delegationId: string }) {
    let found = await this.getDelegation(d);
    if (found.direction === 'exported') {
      await withTransaction(async tdb => {
        let localImports = await tdb.ssoImportedDelegation.findMany({
          where: { localExportedDelegationOid: found.delegation.oid }
        });
        for (let imported of localImports) {
          await this.disableImportWithDb(tdb, {
            imported,
            reason: 'Local exported delegation was deleted'
          });
        }
        await tdb.ssoExportedDelegation.delete({
          where: { oid: found.delegation.oid }
        });
      });
    } else {
      await db.ssoImportedDelegation.delete({
        where: { oid: found.delegation.oid }
      });
    }
    return { id: d.delegationId, direction: found.direction, deleted: true as const };
  }
}

export let ssoDelegationService = Service.create(
  'SsoDelegationService',
  () => new SsoDelegationServiceImpl()
).build();
