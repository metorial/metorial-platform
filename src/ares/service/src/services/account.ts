import { badRequestError, conflictError, notFoundError, ServiceError } from '@lowerdeck/error';
import { createLock } from '@lowerdeck/lock';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { Account, App } from '../../prisma/generated/client';
import { db, withTransaction } from '../db';
import { env } from '../env';
import { getId, ID } from '../id';
import {
  isSsoTenantAssignableToAccount,
  isValidAccountDomain,
  normalizeAccountDomain
} from '../lib/accountPolicy';
import { enqueueReconcileAccountUsers } from '../queues/reconcileAccountUsers';

let accountUpsertLock = createLock({
  name: 'ares/account/upsert',
  redisUrl: env.service.REDIS_URL
});

let accountDomainUpsertLock = createLock({
  name: 'ares/account/domain/upsert',
  redisUrl: env.service.REDIS_URL
});

let withAccountDomainLocks = async <T>(
  appOid: bigint,
  domains: string[],
  cb: () => Promise<T>
): Promise<T> => {
  let [domain, ...remaining] = domains;
  if (!domain) return await cb();

  return await accountDomainUpsertLock.usingLock(
    `${appOid}--${domain}`,
    async () => await withAccountDomainLocks(appOid, remaining, cb)
  );
};

let accountInclude = {
  ssoTenants: {
    orderBy: { id: 'asc' as const }
  },
  accountDomains: {
    orderBy: { domain: 'asc' as const },
    include: {
      allowedTenants: {
        include: { tenant: true },
        orderBy: { id: 'asc' as const }
      },
      allowedConnections: {
        include: { connection: true },
        orderBy: { id: 'asc' as const }
      }
    }
  },
  _count: {
    select: {
      users: true,
      ssoTenants: true,
      accountDomains: true
    }
  }
};

export type AccountDomainInput = {
  domain: string;
  restrictions?: (
    | { type: 'tenant'; tenantId: string }
    | { type: 'connection'; connectionId: string }
  )[];
};

class AccountServiceImpl {
  async upsertAccount(d: {
    app: App;
    input: {
      identifier: string;
      name: string;
      allowEmailLogin?: boolean;
      allowSocialLogin?: boolean;
      ssoTenants: { id: string }[];
      accountDomains: AccountDomainInput[];
    };
  }) {
    let identifier = d.input.identifier.trim();
    let name = d.input.name.trim();
    if (!identifier || !name) {
      throw new ServiceError(
        badRequestError({ message: 'Account identifier and name are required' })
      );
    }

    let ssoTenantIds = [...new Set(d.input.ssoTenants.map(tenant => tenant.id))];
    let normalizedDomains = d.input.accountDomains.map(domain => ({
      domain: normalizeAccountDomain(domain.domain),
      restrictions: domain.restrictions ?? []
    }));
    if (normalizedDomains.some(domain => !isValidAccountDomain(domain.domain))) {
      throw new ServiceError(
        badRequestError({ message: 'Account domains must be valid hostnames' })
      );
    }
    if (
      new Set(normalizedDomains.map(domain => domain.domain)).size !== normalizedDomains.length
    ) {
      throw new ServiceError(badRequestError({ message: 'Account domains must be unique' }));
    }

    let result = await accountUpsertLock.usingLock(
      `${d.app.oid}--${identifier}`,
      async () =>
        await withAccountDomainLocks(
          d.app.oid,
          normalizedDomains.map(domain => domain.domain).sort(),
          async () =>
            await withTransaction(async tdb => {
              let existing = await tdb.account.findUnique({
                where: {
                  appOid_identifier: {
                    appOid: d.app.oid,
                    identifier
                  }
                }
              });
              if (existing?.status === 'deleting') {
                throw new ServiceError(
                  conflictError({ message: 'A deleting account cannot be updated' })
                );
              }

              let restrictionTenantIds = normalizedDomains.flatMap(domain =>
                domain.restrictions.flatMap(restriction =>
                  restriction.type === 'tenant' ? [restriction.tenantId] : []
                )
              );
              let allTenantIds = [...new Set([...ssoTenantIds, ...restrictionTenantIds])];
              let tenants = await tdb.ssoTenant.findMany({
                where: {
                  appOid: d.app.oid,
                  id: { in: allTenantIds }
                }
              });
              if (tenants.length !== allTenantIds.length) {
                throw new ServiceError(
                  badRequestError({
                    message: 'One or more SSO tenants are invalid for this app'
                  })
                );
              }
              let selectedTenants = tenants.filter(tenant => ssoTenantIds.includes(tenant.id));
              if (selectedTenants.some(tenant => tenant.enrollment == 'app')) {
                throw new ServiceError(
                  conflictError({
                    message: 'App-enrolled SSO tenants cannot be assigned to an account'
                  })
                );
              }
              if (
                selectedTenants.some(
                  tenant =>
                    !isSsoTenantAssignableToAccount({
                      enrollment: tenant.enrollment,
                      accountOid: tenant.accountOid,
                      targetAccountOid: existing?.oid
                    })
                )
              ) {
                throw new ServiceError(
                  conflictError({
                    message: 'One or more SSO tenants belong to another account'
                  })
                );
              }

              let desiredTenantIdSet = new Set(ssoTenantIds);
              if (restrictionTenantIds.some(tenantId => !desiredTenantIdSet.has(tenantId))) {
                throw new ServiceError(
                  badRequestError({
                    message:
                      'Domain restrictions may only reference tenants assigned to the account'
                  })
                );
              }

              let connectionIds = [
                ...new Set(
                  normalizedDomains.flatMap(domain =>
                    domain.restrictions.flatMap(restriction =>
                      restriction.type === 'connection' ? [restriction.connectionId] : []
                    )
                  )
                )
              ];
              let connections = await tdb.ssoConnection.findMany({
                where: {
                  id: { in: connectionIds },
                  tenant: { appOid: d.app.oid }
                },
                include: { tenant: true }
              });
              if (connections.length !== connectionIds.length) {
                throw new ServiceError(
                  badRequestError({
                    message: 'One or more SSO connections are invalid for this app'
                  })
                );
              }
              if (
                connections.some(connection => !desiredTenantIdSet.has(connection.tenant.id))
              ) {
                throw new ServiceError(
                  badRequestError({
                    message:
                      'Restricted connections must belong to a tenant assigned to the account'
                  })
                );
              }

              let account = await tdb.account.upsert({
                where: {
                  appOid_identifier: {
                    appOid: d.app.oid,
                    identifier
                  }
                },
                create: {
                  ...getId('account'),
                  clientId: await ID.generateId('account_clientId'),
                  appOid: d.app.oid,
                  identifier,
                  name,
                  allowEmailLogin: d.input.allowEmailLogin ?? true,
                  allowSocialLogin: d.input.allowSocialLogin ?? true
                },
                update: {
                  name,
                  allowEmailLogin: d.input.allowEmailLogin,
                  allowSocialLogin: d.input.allowSocialLogin
                }
              });

              let removedTenants = await tdb.ssoTenant.findMany({
                where: {
                  accountOid: account.oid,
                  id: { notIn: ssoTenantIds }
                },
                select: { oid: true }
              });
              if (removedTenants.length > 0) {
                await tdb.ssoTenant.updateMany({
                  where: { oid: { in: removedTenants.map(tenant => tenant.oid) } },
                  data: { accountOid: null, enrollment: 'disabled' }
                });
              }
              if (ssoTenantIds.length > 0) {
                let selectedTenantOids = selectedTenants.map(tenant => tenant.oid);
                await tdb.accountDomainSsoTenant.deleteMany({
                  where: {
                    tenantOid: { in: selectedTenantOids },
                    domain: { accountOid: { not: account.oid } }
                  }
                });
                await tdb.accountDomainSsoConnection.deleteMany({
                  where: {
                    connection: { tenantOid: { in: selectedTenantOids } },
                    domain: { accountOid: { not: account.oid } }
                  }
                });
                let assignedTenants = await tdb.ssoTenant.updateMany({
                  where: {
                    appOid: d.app.oid,
                    id: { in: ssoTenantIds },
                    OR: [
                      { enrollment: 'disabled', accountOid: null },
                      { enrollment: 'account', accountOid: account.oid }
                    ]
                  },
                  data: { accountOid: account.oid, enrollment: 'account' }
                });
                if (assignedTenants.count !== ssoTenantIds.length) {
                  throw new ServiceError(
                    conflictError({
                      message: 'One or more SSO tenants are no longer available'
                    })
                  );
                }
              }

              let desiredDomains = normalizedDomains.map(domain => domain.domain);
              let previousDomains = await tdb.accountDomain.findMany({
                where: {
                  appOid: d.app.oid,
                  OR: [{ accountOid: account.oid }, { domain: { in: desiredDomains } }]
                }
              });
              await tdb.accountDomain.deleteMany({
                where: {
                  accountOid: account.oid,
                  domain: { notIn: desiredDomains }
                }
              });

              let tenantById = new Map(tenants.map(tenant => [tenant.id, tenant]));
              let connectionById = new Map(
                connections.map(connection => [connection.id, connection])
              );
              for (let domainInput of normalizedDomains) {
                let domain = await tdb.accountDomain.upsert({
                  where: {
                    appOid_domain: {
                      appOid: d.app.oid,
                      domain: domainInput.domain
                    }
                  },
                  create: {
                    ...getId('accountDomain'),
                    appOid: d.app.oid,
                    accountOid: account.oid,
                    domain: domainInput.domain
                  },
                  update: {
                    accountOid: account.oid
                  }
                });

                await tdb.accountDomainSsoTenant.deleteMany({
                  where: { domainOid: domain.oid }
                });
                await tdb.accountDomainSsoConnection.deleteMany({
                  where: { domainOid: domain.oid }
                });
                let domainTenantIds = [
                  ...new Set(
                    domainInput.restrictions.flatMap(restriction =>
                      restriction.type === 'tenant' ? [restriction.tenantId] : []
                    )
                  )
                ];
                let domainConnectionIds = [
                  ...new Set(
                    domainInput.restrictions.flatMap(restriction =>
                      restriction.type === 'connection' ? [restriction.connectionId] : []
                    )
                  )
                ];
                for (let tenantId of domainTenantIds) {
                  await tdb.accountDomainSsoTenant.create({
                    data: {
                      ...getId('accountDomainSsoTenant'),
                      domainOid: domain.oid,
                      tenantOid: tenantById.get(tenantId)!.oid
                    }
                  });
                }
                for (let connectionId of domainConnectionIds) {
                  await tdb.accountDomainSsoConnection.create({
                    data: {
                      ...getId('accountDomainSsoConnection'),
                      domainOid: domain.oid,
                      connectionOid: connectionById.get(connectionId)!.oid
                    }
                  });
                }
              }

              return {
                account: await tdb.account.findUniqueOrThrow({
                  where: { oid: account.oid },
                  include: accountInclude
                }),
                reconcileDomains: [
                  ...new Set([
                    ...previousDomains.map(domain => domain.domain),
                    ...desiredDomains
                  ])
                ]
              };
            })
        )
    );

    await Promise.all(
      result.reconcileDomains.map(domain =>
        enqueueReconcileAccountUsers({ appId: d.app.id, domain })
      )
    );
    return result.account;
  }

  async listAccounts(d: {
    app: App;
    filters?: {
      identifier?: string;
      search?: string;
      status?: 'active' | 'deleting';
    };
  }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.account.findMany({
            ...opts,
            where: {
              appOid: d.app.oid,
              AND: [
                d.filters?.identifier ? { identifier: d.filters.identifier } : {},
                d.filters?.search
                  ? {
                      OR: [
                        { identifier: { contains: d.filters.search, mode: 'insensitive' } },
                        { name: { contains: d.filters.search, mode: 'insensitive' } },
                        {
                          accountDomains: {
                            some: {
                              domain: {
                                contains: d.filters.search,
                                mode: 'insensitive'
                              }
                            }
                          }
                        }
                      ]
                    }
                  : {}
              ],
              status: d.filters?.status
            },
            include: accountInclude
          })
      )
    );
  }

  async getAccountById(d: { accountId: string }) {
    let account = await db.account.findFirst({
      where: {
        id: d.accountId
      },
      include: accountInclude
    });
    if (!account) throw new ServiceError(notFoundError('account', d.accountId));
    return account;
  }

  async deleteAccount(d: { account: Account }) {
    let deleting = await withTransaction(async tdb => {
      let account = await tdb.account.findUnique({
        where: { oid: d.account.oid },
        include: accountInclude
      });
      if (!account) throw new ServiceError(notFoundError('account', d.account.id));
      if (account.status === 'deleting') return account;

      let deletingAccount = await tdb.account.update({
        where: { oid: account.oid },
        data: { status: 'deleting' },
        include: accountInclude
      });
      await tdb.ssoTenant.updateMany({
        where: { accountOid: account.oid },
        data: { accountOid: null, enrollment: 'disabled' }
      });
      await tdb.accountDomain.deleteMany({
        where: { accountOid: account.oid }
      });
      await tdb.authIntent.deleteMany({
        where: { accountOid: account.oid }
      });
      await tdb.authAttempt.deleteMany({
        where: { accountOid: account.oid }
      });
      await tdb.ssoAuth.deleteMany({
        where: { accountOid: account.oid }
      });
      return deletingAccount;
    });
    await enqueueReconcileAccountUsers({ accountId: deleting.id });
    return deleting;
  }
}

export let accountService = Service.create(
  'AccountService',
  () => new AccountServiceImpl()
).build();
