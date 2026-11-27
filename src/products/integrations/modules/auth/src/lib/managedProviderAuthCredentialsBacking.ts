import { badRequestError, ServiceError } from '@lowerdeck/error';
import { recordManagedCredentialsAuditEvent } from './managedCredentialsAudit';
import { createLock } from '@lowerdeck/lock';
import {
  addAfterTransactionHook,
  db,
  getId,
  snowflake,
  type Tenant,
  withTransaction
} from '@metorial-subspace/db';
import { getMetorialSolution } from '@metorial-subspace/module-tenant';
import { getBackend } from '@metorial-subspace/provider';
import { normalizeManagedOAuthScopeIds } from './managedOAuthScopes';
import {
  type ManagedProviderAuthCredentialsBackingSource,
  managedProviderAuthCredentialsBackingSourceInclude
} from './managedProviderAuthCredentialsBackingInclude';
import { env } from '../env';
import {
  providerAuthCredentialsCreatedQueue,
  providerAuthCredentialsUpdatedQueue
} from '../queues/lifecycle/providerAuthCredentials';

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

let managedCredentialsSyncInclude = {
  provider: managedProviderAuthCredentialsBackingSourceInclude.provider,
  initialProviderAuthMethod:
    managedProviderAuthCredentialsBackingSourceInclude.initialProviderAuthMethod
};

type ManagedCredentialsSyncSource = Omit<
  ManagedProviderAuthCredentialsBackingSource,
  'backings'
>;

let getDesiredBackingStatus = (managedCredentials: { status: string }) =>
  managedCredentials.status === 'archived' ? ('archived' as const) : ('active' as const);

export let ensureManagedProviderAuthCredentialsBacking = async (d: {
  tenant: Tenant;
  managedCredentials: ManagedCredentialsSyncSource;
  providerAuthMethod: {
    globalOid: bigint;
  };
}) => {
  let solution = await getMetorialSolution();

  let assertAuthMethodMatches = (managedCredentials: ManagedCredentialsSyncSource) => {
    if (
      getProviderAuthMethodGlobalOid(managedCredentials) !== d.providerAuthMethod.globalOid
    ) {
      throw new ServiceError(
        badRequestError({
          message: 'Managed credentials can only be used with their configured auth method',
          code: 'managed_credentials_auth_method_mismatch'
        })
      );
    }
  };
  assertAuthMethodMatches(d.managedCredentials);

  let getExistingBacking = async () => {
    let backing = await db.managedProviderAuthCredentialsBacking.findUnique({
      where: {
        managedCredentialsOid_tenantOid: {
          managedCredentialsOid: d.managedCredentials.oid,
          tenantOid: d.tenant.oid
        }
      },
      include: {
        providerAuthCredentials: true
      }
    });

    return backing?.providerAuthCredentials ?? null;
  };

  let missingResourceOidData = (backing: { projectOid: bigint | null }) => ({
    ...(d.tenant.projectOid != null && backing.projectOid !== d.tenant.projectOid
      ? { projectOid: d.tenant.projectOid }
      : {})
  });

  let backfillResourceOids = async (
    backing: NonNullable<Awaited<ReturnType<typeof getExistingBacking>>>
  ) => {
    let data = missingResourceOidData(backing);
    if (Object.keys(data).length === 0) return backing;

    return await db.providerAuthCredentials.update({
      where: { oid: backing.oid },
      data
    });
  };

  let isBackingFresh = (
    backing: Awaited<ReturnType<typeof getExistingBacking>>,
    managedCredentials: ManagedCredentialsSyncSource
  ): backing is NonNullable<Awaited<ReturnType<typeof getExistingBacking>>> =>
    !!backing &&
    backing.updatedAt.getTime() >= managedCredentials.updatedAt.getTime() &&
    backing.status === getDesiredBackingStatus(managedCredentials);

  let syncBacking = async (
    existing: Awaited<ReturnType<typeof getExistingBacking>>,
    managedCredentials: ManagedCredentialsSyncSource
  ) => {
    let provider = getProviderForManagedCredentials(managedCredentials);
    let managedScopeIds = normalizeManagedOAuthScopeIds(managedCredentials.oauthScopes);
    let desiredStatus = getDesiredBackingStatus(managedCredentials);
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
    let existingScopeIds = normalizeManagedOAuthScopeIds(existing?.scopes);
    let desiredScopes = (existingScopeIds.length ? existingScopeIds : managedScopeIds).filter(
      scope => managedScopeIds.includes(scope)
    );

    let backendProviderAuthCredentials = await backend.auth.createProviderAuthCredentials({
      tenant: d.tenant,
      provider,
      input: {
        type: 'oauth',
        clientId: managedCredentials.oauthClientId,
        clientSecret: managedCredentials.oauthClientSecret,
        scopes: desiredScopes
      }
    });

    if (existing) {
      return await withTransaction(async db => {
        let updated = await db.providerAuthCredentials.update({
          where: {
            oid: existing.oid
          },
          data: {
            type: backendProviderAuthCredentials.type,
            status: desiredStatus,
            origin: 'managed_backing',
            backendOid: backend.backend.oid,
            isAutoRegistration: backendProviderAuthCredentials.isAutoRegistration,
            slateCredentialsOid: backendProviderAuthCredentials.slateOAuthCredentials?.oid,
            shuttleCredentialsOid: backendProviderAuthCredentials.shuttleOAuthCredentials?.oid,
            name: managedCredentials.name,
            description: managedCredentials.description,
            metadata: managedCredentials.metadata,
            scopes: desiredScopes,
            needsScopeSync: false,
            projectOid: d.tenant.projectOid
          }
        });

        await addAfterTransactionHook(async () => {
          await providerAuthCredentialsUpdatedQueue.add({
            providerAuthCredentialsId: updated.id
          });

          await recordManagedCredentialsAuditEvent({
            action: 'update',
            authCredentials: { ...updated, provider },
            previousAuthCredentials: { ...existing, provider },
            projectOid: d.tenant.projectOid
          });
        });

        return updated;
      });
    }

    return await withTransaction(async db => {
      let backingCredentials = await db.providerAuthCredentials.create({
        data: {
          ...getId('providerAuthCredentials'),
          type: backendProviderAuthCredentials.type,
          status: desiredStatus,
          origin: 'managed_backing',
          backendOid: backend.backend.oid,
          isAutoRegistration: backendProviderAuthCredentials.isAutoRegistration,
          slateCredentialsOid: backendProviderAuthCredentials.slateOAuthCredentials?.oid,
          shuttleCredentialsOid: backendProviderAuthCredentials.shuttleOAuthCredentials?.oid,
          name: managedCredentials.name,
          description: managedCredentials.description,
          metadata: managedCredentials.metadata,
          scopes: desiredScopes,
          needsScopeSync: false,
          isEphemeral: false,
          isDefault: false,
          tenantOid: d.tenant.oid,
          projectOid: d.tenant.projectOid,
          solutionOid: solution.oid,
          providerOid: provider.oid
        }
      });

      await db.managedProviderAuthCredentialsBacking.create({
        data: {
          oid: snowflake.nextId(),
          managedCredentialsOid: managedCredentials.oid,
          providerAuthCredentialsOid: backingCredentials.oid,
          tenantOid: d.tenant.oid,
          projectOid: d.tenant.projectOid,
          solutionOid: solution.oid
        }
      });

      await addAfterTransactionHook(async () => {
        await providerAuthCredentialsCreatedQueue.add({
          providerAuthCredentialsId: backingCredentials.id
        });

        await recordManagedCredentialsAuditEvent({
          action: 'create',
          authCredentials: { ...backingCredentials, provider },
          projectOid: d.tenant.projectOid
        });
      });

      return backingCredentials;
    });
  };

  let settleConcurrentArchive = async (
    backing: NonNullable<Awaited<ReturnType<typeof getExistingBacking>>>
  ) => {
    if (backing.status !== 'active') return backing;

    let latest = await db.managedProviderAuthCredentials.findUnique({
      where: { oid: d.managedCredentials.oid },
      select: { status: true }
    });
    if (latest && getDesiredBackingStatus(latest) === 'active') return backing;

    return await db.providerAuthCredentials.update({
      where: { oid: backing.oid },
      data: { status: 'archived' }
    });
  };

  let existingBacking = await getExistingBacking();
  if (isBackingFresh(existingBacking, d.managedCredentials)) {
    return await backfillResourceOids(existingBacking);
  }

  return await createManagedBackingLock.usingLock(
    [String(d.managedCredentials.oid), d.tenant.id],
    async () => {
      let managedCredentials =
        (await db.managedProviderAuthCredentials.findUnique({
          where: { oid: d.managedCredentials.oid },
          include: managedCredentialsSyncInclude
        })) ?? d.managedCredentials;
      assertAuthMethodMatches(managedCredentials);

      let lockedExistingBacking = await getExistingBacking();
      if (isBackingFresh(lockedExistingBacking, managedCredentials)) {
        return await backfillResourceOids(lockedExistingBacking);
      }

      return await settleConcurrentArchive(
        await syncBacking(lockedExistingBacking, managedCredentials)
      );
    }
  );
};

export let reconcileTenantManagedProviderAuthCredentialsBackings = async (d: {
  tenant: Tenant;
}) => {
  let solution = await getMetorialSolution();
  let managedCredentialsList = await db.managedProviderAuthCredentials.findMany({
    where: {
      solutionOid: solution.oid,
      status: 'active'
    },
    include: {
      ...managedProviderAuthCredentialsBackingSourceInclude,
      backings: {
        where: {
          tenantOid: d.tenant.oid,
          solutionOid: solution.oid
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

      await ensureManagedProviderAuthCredentialsBacking({
        tenant: d.tenant,
        managedCredentials,
        providerAuthMethod: {
          globalOid: managedCredentialsGlobalOid
        }
      });
    })
  );
};
