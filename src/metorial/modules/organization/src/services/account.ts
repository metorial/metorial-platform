import { Service } from '@lowerdeck/service';
import { Account, db, ID, Organization } from '@metorial/db';

let accountRef: { current: ((organization: Organization) => Promise<Account>) | null } = {
  current: null
};

export let setAccountGetter = (ref: (organization: Organization) => Promise<Account>) => {
  accountRef.current = ref;
};

class AccountServiceImpl {
  async getAccountForOrganization(i: { organization: Organization }) {
    if (accountRef.current) return await accountRef.current(i.organization);

    let existingAccount = await db.account.findFirst({
      where: { ownerOrganizationOid: i.organization.oid }
    });
    if (existingAccount) return existingAccount;

    return await db.account.create({
      data: {
        id: await ID.generateId('account'),
        ownerOrganizationOid: i.organization.oid,
        type: 'organization'
      }
    });
  }
}

export let accountService = Service.create('account', () => new AccountServiceImpl()).build();
