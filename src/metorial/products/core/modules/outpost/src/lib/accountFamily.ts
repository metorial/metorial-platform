import type { Account, Prisma } from '@metorial/db';

export let rootAccountOidOf = (account: Pick<Account, 'oid' | 'rootOwnerAccountOid'>) =>
  account.rootOwnerAccountOid ?? account.oid;

export let accountFamilyWhere = (rootAccountOid: bigint): Prisma.AccountWhereInput => ({
  OR: [{ oid: rootAccountOid }, { rootOwnerAccountOid: rootAccountOid }]
});
