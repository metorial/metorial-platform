import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { db, type Solution } from '@metorial-subspace/db';

let include = {
  session: true,
  tenant: true
};

class sessionUsageRecordServiceImpl {
  async listSessionUsageRecords(d: { solution: Solution }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.sessionUsageRecord.findMany({
            ...opts,
            where: { solutionOid: d.solution.oid },
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
