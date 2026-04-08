import { createIdGenerator, idType } from '@lowerdeck/id';
import { Snowflake } from '@lowerdeck/snowflake';

export let ID = createIdGenerator({
  tenant: idType.sorted('otn_'),
  actor: idType.sorted('oac_'),

  codeBucket: idType.sorted('ocb_'),
  codeBucketPurpose: idType.sorted('ocp_'),
  codeBucketTemplate: idType.sorted('oct_'),

  changeNotification: idType.sorted('ocn_'),

  scmBackend: idType.sorted('osb_'),
  scmAccount: idType.sorted('osa_'),
  scmRepository: idType.sorted('osr_'),
  scmInstallation: idType.sorted('osi_'),
  scmInstallationSession: idType.sorted('osis_'),
  scmBackendSetupSession: idType.sorted('obss_'),
  scmRepositoryWebhook: idType.sorted('osw_'),
  scmRepositoryReceivedEvent: idType.sorted('ose_'),
  scmRepositoryPush: idType.sorted('osp_')
});

let workerIdBits = 12;
let workerIdMask = (1 << workerIdBits) - 1;

let workerId = (() => {
  let array = new Uint16Array(1);
  crypto.getRandomValues(array);
  return array[0]! & workerIdMask;
})();

export let snowflake = new Snowflake({
  workerId,
  datacenterId: 0,
  workerIdBits: workerIdBits,
  datacenterIdBits: 0,
  sequenceBits: 9,
  epoch: new Date('2025-06-01T00:00:00Z')
});

export let getId = <K extends Parameters<typeof ID.generateIdSync>[0]>(model: K) => ({
  oid: snowflake.nextId(),
  id: ID.generateIdSync(model)
});
