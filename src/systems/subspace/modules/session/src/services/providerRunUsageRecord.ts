import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { db, type Solution } from '@metorial-subspace/db';

let include = {
  providerRun: true,
  tenant: true
};

class providerRunUsageRecordServiceImpl {
  async listProviderRunUsageRecords(d: { solution: Solution }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.providerRunUsageRecord.findMany({
            ...opts,
            where: { solutionOid: d.solution.oid },
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
