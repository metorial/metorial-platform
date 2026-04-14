import { createIdGenerator, idType } from '@lowerdeck/id';
import { Snowflake } from '@lowerdeck/snowflake';

export let ID = createIdGenerator({
  tenant: idType.sorted('bten_'),

  provider: idType.sorted('bpro_'),
  runtime: idType.sorted('brtm_'),

  function: idType.sorted('bfnc_'),
  functionVersion: idType.sorted('bfv_'),
  functionDeployment: idType.sorted('bfd_'),
  functionDeploymentStep: idType.sorted('bfds_'),
  functionInvocation: idType.sorted('bfi_'),
  functionBundle: idType.sorted('bfb_')
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
