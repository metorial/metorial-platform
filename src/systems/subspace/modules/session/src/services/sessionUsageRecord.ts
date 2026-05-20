import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { db, type Solution, type Tenant } from '@metorial-subspace/db';
import { mergeRetentionWithDateFilter } from '@metorial-subspace/list-utils';

let include = {
  session: true,
  tenant: true
};

class sessionUsageRecordServiceImpl {
  async listSessionUsageRecords(d: { tenant: Tenant; solution: Solution }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.sessionUsageRecord.findMany({
            ...opts,
            where: {
              solutionOid: d.solution.oid,
              ...mergeRetentionWithDateFilter(d.tenant)
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
