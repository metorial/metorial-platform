import { createIdGenerator, idType } from '@lowerdeck/id';
import { Snowflake } from '@lowerdeck/snowflake';

export let ID = createIdGenerator({
  tenant: idType.sorted('fins_'),

  provider: idType.sorted('fpro_'),

  workflow: idType.sorted('fwof_'),
  workflowRun: idType.sorted('fwor_'),
  workflowVersion: idType.sorted('fwov_'),
  workflowArtifact: idType.sorted('fwoa_'),
  workflowRunStep: idType.sorted('fwos_'),
  workflowVersionStep: idType.sorted('fwvs_')
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
