import { db, getId } from '@metorial-subspace/db';
import { providerRunStartQueue } from '../../queues/provderRun/providerRunStart';
import type { ConnectionBaseState } from './base';

export let createProviderRun = async ({
  instance,
  version,
  session,
  connection
}: ConnectionBaseState) => {
  let providerRun = await db.providerRun.create({
    data: {
      ...getId('providerRun'),
      providerOid: instance.sessionProvider.providerOid,
      providerVersionOid: version.oid,
      sessionOid: instance.sessionProvider.sessionOid,
      instanceOid: instance.oid,
      connectionOid: connection.oid,
      sessionProviderOid: instance.sessionProvider.oid,
      tenantOid: session.tenantOid,
      solutionOid: session.solutionOid,
      environmentOid: session.environmentOid
    }
  });

  await providerRunStartQueue.add({
    providerRunId: providerRun.id
  });

  return providerRun;
};
