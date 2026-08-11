import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { db, type Tenant } from '@metorial-subspace/db';
import { mergeRetentionWithDateFilter } from '@metorial-subspace/list-utils';
import { getMetorialSolution } from '@metorial-subspace/module-tenant';

let include = {
  session: true,
  tenant: true
};

class sessionUsageRecordServiceImpl {
  async listSessionUsageRecords(d: { tenant?: Tenant }) {
    let solution = await getMetorialSolution();

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.sessionUsageRecord.findMany({
            ...opts,
            where: {
              solutionOid: solution.oid,
              ...(d.tenant ? mergeRetentionWithDateFilter(d.tenant) : {})
            },
            include
          })
      )
    );
  }
}

export let sessionUsageRecordService = Service.create(
  'sessionUsageRecordService',
  () => new sessionUsageRecordServiceImpl()
).build();
