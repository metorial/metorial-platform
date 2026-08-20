import { badRequestError, ServiceError } from '@lowerdeck/error';
import { createLock } from '@lowerdeck/lock';
import {
  addAfterTransactionHook,
  db,
  getId,
  snowflake,
  type Solution,
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';
import { getBackend } from '@metorial-subspace/provider';
import { normalizeManagedOAuthScopeIds } from './managedOAuthScopes';
import {
  type ManagedProviderAuthCredentialsBackingSource,
  managedProviderAuthCredentialsBackingSourceInclude
} from './managedProviderAuthCredentialsBackingInclude';
import { env } from '../env';
import { providerAuthCredentialsUpdatedQueue } from '../queues/lifecycle/providerAuthCredentials';
import {
  MANAGED_SECRET_PURPOSE,
  reconcileManagedCredentialBackingProjection,
  resolveManagedCredentialBackingSecret
} from './managedProviderAuthCredentialsSecret';

export type { ManagedProviderAuthCredentialsBackingSource } from './managedProviderAuthCredentialsBackingInclude';
export { managedProviderAuthCredentialsBackingSourceInclude } from './managedProviderAuthCredentialsBackingInclude';

let createManagedBackingLock = createLock({
  name: 'sub/auth/acred/mng/backing/lock',
  redisUrl: env.service.REDIS_URL
});

let getProviderForManagedCredentials = (managedCredentials: {
  provider: ManagedProviderAuthCredentialsBackingSource['provider'];
  initialProviderAuthMethod: ManagedProviderAuthCredentialsBackingSource['initialProviderAuthMethod'];
}) => managedCredentials.provider ?? managedCredentials.initialProviderAuthMethod.provider;

let getProviderAuthMethodGlobalOid = (managedCredentials: {
  providerAuthMethodGlobalOid: bigint | null;
  initialProviderAuthMethod: {
    globalOid: bigint;
  };
}) =>
  managedCredentials.providerAuthMethodGlobalOid ??
  managedCredentials.initialProviderAuthMethod.globalOid;

export let ensureManagedProviderAuthCredentialsBacking = async (d: {
  tenant: Tenant;
  solution: Solution;
  managedCredentials: ManagedProviderAuthCredentialsBackingSource;
  providerAuthMethod: {
    globalOid: bigint;
  };
}) => {
  let provider = getProviderForManagedCredentials(d.managedCredentials);
  let managedCredentialsGlobalOid = getProviderAuthMethodGlobalOid(d.managedCredentials);
  let managedScopeIds = normalizeManagedOAuthScopeIds(d.managedCredentials.oauthScopes);
  let desiredStatus =
    d.managedCredentials.status === 'archived' ? ('archived' as const) : ('active' as const);
  let syncAfter = d.managedCredentials.updatedAt.getTime();

  if (managedCredentialsGlobalOid !== d.providerAuthMethod.globalOid) {
    throw new ServiceError(
      badRequestError({
        message: 'Managed credentials can only be used with their configured auth method',
        code: 'managed_credentials_auth_method_mismatch'
      })
    );
  }

  let getExistingBacking = async () => {
    let backing = await db.managedProviderAuthCredentialsBacking.findUnique({
      where: {
        managedCredentialsOid_tenantOid: {
          managedCredentialsOid: d.managedCredentials.oid,
          tenantOid: d.tenant.oid
        }
      },
      include: {
        providerAuthCredentials: true,
        secrets: {
          where: { purpose: MANAGED_SECRET_PURPOSE },
          orderBy: { secretVersion: 'desc' }
        }
      }
    });
    return backing;
  };

  let isBackingFresh = (
    backing: Awaited<ReturnType<typeof getExistingBacking>>
  ): backing is NonNullable<Awaited<ReturnType<typeof getExistingBacking>>> =>
    !!backing &&
    backing.updatedAt.getTime() >= syncAfter &&
    backing.providerAuthCredentials.updatedAt.getTime() >= syncAfter &&
    backing.providerAuthCredentials.status === desiredStatus;

  let resolveWorkloadBacking = async (
    backing: NonNullable<Awaited<ReturnType<typeof getExistingBacking>>>
  ) => {
    let resolved = await resolveManagedCredentialBackingSecret({
      tenant: d.tenant,
      managedCredentialsOid: d.managedCredentials.oid
    });
    if (resolved.state === 'not_migrated') {
      throw new Error('Authoritative managed backing projection is unavailable');
    }
    return { plaintext: resolved.plaintext };
  };

  let syncBacking = async (existing: Awaited<ReturnType<typeof getExistingBacking>>) => {
    let defaultVariant = provider.defaultVariant;
    if (!defaultVariant) {
      throw new Error('Provider has no default variant');
    }

    let backend = await getBackend({
      entity: {
        backendOid: defaultVariant.backendOid
      }
    });

    // Older rows may still contain scope objects instead of scope IDs.
    let existingScopeIds = normalizeManagedOAuthScopeIds(
      existing?.providerAuthCredentials.scopes
    );
    let desiredScopes = (existingScopeIds.length ? existingScopeIds : managedScopeIds).filter(
      scope => managedScopeIds.includes(scope)
    );

    if (existing) {
      if (existing.updatedAt.getTime() < syncAfter) {
        await reconcileManagedCredentialBackingProjection({
          tenantOid: d.tenant.oid,
          managedCredentialsOid: d.managedCredentials.oid
        });
        existing = await getExistingBacking();
        if (!existing) throw new Error('Managed backing disappeared during projection');
      }
      let backing = existing;
      let projected = await resolveWorkloadBacking(backing);
      return await withTransaction(async db => {
        let backendProviderAuthCredentials = await backend.auth.createProviderAuthCredentials({
          tenant: d.tenant,
          provider,
          input: {
            type: 'oauth',
            clientId: d.managedCredentials.oauthClientId,
            clientSecret: projected.plaintext,
            scopes: desiredScopes
          }
        });
        let updated = await db.providerAuthCredentials.update({
          where: {
            oid: backing.providerAuthCredentials.oid
          },
          data: {
            type: backendProviderAuthCredentials.type,
            status: desiredStatus,
            origin: 'managed_backing',
            backendOid: backend.backend.oid,
            isAutoRegistration: backendProviderAuthCredentials.isAutoRegistration,
            slateCredentialsOid: backendProviderAuthCredentials.slateOAuthCredentials?.oid,
            shuttleCredentialsOid: backendProviderAuthCredentials.shuttleOAuthCredentials?.oid,
            name: d.managedCredentials.name,
            description: d.managedCredentials.description,
            metadata: d.managedCredentials.metadata,
            scopes: desiredScopes,
            needsScopeSync: false
          }
        });

        await addAfterTransactionHook(async () =>
          providerAuthCredentialsUpdatedQueue.add({
            providerAuthCredentialsId: updated.id
          })
        );

        return updated;
      });
    }

    let created = await withTransaction(async db => {
      let backingCredentials = await db.providerAuthCredentials.create({
        data: {
          ...getId('providerAuthCredentials'),
          type: 'oauth',
          status: desiredStatus,
          origin: 'managed_backing',
          backendOid: backend.backend.oid,
          isAutoRegistration: false,
          name: d.managedCredentials.name,
          description: d.managedCredentials.description,
          metadata: d.managedCredentials.metadata,
          scopes: desiredScopes,
          needsScopeSync: false,
          isEphemeral: false,
          isDefault: false,
          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid,
          providerOid: provider.oid
        }
      });

      let backing = await db.managedProviderAuthCredentialsBacking.create({
        data: {
          oid: snowflake.nextId(),
          managedCredentialsOid: d.managedCredentials.oid,
          providerAuthCredentialsOid: backingCredentials.oid,
          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid
        }
      });

      return { backing, backingCredentials };
    });
    await reconcileManagedCredentialBackingProjection({
      tenantOid: d.tenant.oid,
      managedCredentialsOid: d.managedCredentials.oid
    });
    let projectedBacking = await getExistingBacking();
    if (!projectedBacking) {
      throw new Error(
        `Authoritative managed backing projection is unavailable for ${created.backingCredentials.id}`
      );
    }
    return await syncBacking(projectedBacking);
  };

  let existingBacking = await getExistingBacking();
  if (isBackingFresh(existingBacking)) {
    await resolveWorkloadBacking(existingBacking);
    return existingBacking.providerAuthCredentials;
  }

  return await createManagedBackingLock.usingLock(
    [String(d.managedCredentials.oid), d.tenant.id],
    async () => {
      let lockedExistingBacking = await getExistingBacking();
      if (isBackingFresh(lockedExistingBacking)) {
        await resolveWorkloadBacking(lockedExistingBacking);
        return lockedExistingBacking.providerAuthCredentials;
      }

      return await syncBacking(lockedExistingBacking);
    }
  );
};

export let reconcileTenantManagedProviderAuthCredentialsBackings = async (d: {
  tenant: Tenant;
  solution: Solution;
}) => {
  let managedCredentialsList = await db.managedProviderAuthCredentials.findMany({
    where: {
      solutionOid: d.solution.oid,
      status: 'active'
    },
    include: {
      ...managedProviderAuthCredentialsBackingSourceInclude,
      backings: {
        where: {
          tenantOid: d.tenant.oid,
          solutionOid: d.solution.oid
        },
        take: 1,
        include: {
          providerAuthCredentials: {
            select: {
              oid: true,
              id: true,
              status: true,
              scopes: true,
              updatedAt: true
            }
          }
        }
      }
    }
  });

  await Promise.all(
    managedCredentialsList.map(async managedCredentials => {
      let managedCredentialsGlobalOid = getProviderAuthMethodGlobalOid(managedCredentials);

      await reconcileManagedCredentialBackingProjection({
        tenantOid: d.tenant.oid,
        managedCredentialsOid: managedCredentials.oid
      });

      await ensureManagedProviderAuthCredentialsBacking({
        tenant: d.tenant,
        solution: d.solution,
        managedCredentials,
        providerAuthMethod: {
          globalOid: managedCredentialsGlobalOid
        }
      });
    })
  );
};
