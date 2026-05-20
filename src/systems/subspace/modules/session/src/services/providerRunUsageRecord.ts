import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { db, type Solution, type Tenant } from '@metorial-subspace/db';
import { mergeRetentionWithDateFilter } from '@metorial-subspace/list-utils';

let include = {
  providerRun: true,
  tenant: true
};

class providerRunUsageRecordServiceImpl {
  async listProviderRunUsageRecords(d: { tenant?: Tenant; solution: Solution }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.providerRunUsageRecord.findMany({
            ...opts,
            where: {
              solutionOid: d.solution.oid,
              ...(d.tenant ? mergeRetentionWithDateFilter(d.tenant) : {})
            },
            include
          })
      )
    );
  }
}

export let providerRunUsageRecordService = Service.create(
  'providerRunUsageRecordService',
  () => new providerRunUsageRecordServiceImpl()
).build();
