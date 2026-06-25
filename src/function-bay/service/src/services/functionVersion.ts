import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { Function } from '../../prisma/generated/client';
import { db } from '../db';

let include = {
  function: {
    include: {
      currentVersion: true
    }
  },
  runtime: {
    include: {
      provider: true
    }
  }
};

class functionVersionServiceImpl {
  async getFunctionVersionById(d: { id: string; function: Function }) {
    let functionVersion = await db.functionVersion.findFirst({
      where: {
        OR: [{ id: d.id }, { identifier: d.id }],
        functionOid: d.function.oid
      },
      include
    });
    if (!functionVersion) throw new ServiceError(notFoundError('function.version'));
    return functionVersion;
  }

  async listFunctionVersions(d: { function: Function }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.functionVersion.findMany({
            ...opts,
            where: {
              functionOid: d.function.oid
            },
            include
          })
      )
    );
  }
}

export let functionVersionService = Service.create(
  'functionVersionService',
  () => new functionVersionServiceImpl()
).build();
