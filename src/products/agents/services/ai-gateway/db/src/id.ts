import { createIdGenerator, idType } from '@lowerdeck/id';
import { Snowflake } from '@lowerdeck/snowflake';

export let ID = createIdGenerator({
  organization: idType.sorted('gwor_'),
  project: idType.sorted('gwpr_'),
  instance: idType.sorted('gwin_'),
  gatewayToken: idType.sorted('gwtk_'),
  catalogSync: idType.sorted('gwcs_'),
  lab: idType.sorted('gwlb_'),
  provider: idType.sorted('gwpv_'),
  model: idType.sorted('gwmd_'),
  modelOffering: idType.sorted('gwof_'),
  modelAlias: idType.sorted('gwma_'),
  providerConnection: idType.sorted('gwpc_'),
  inferenceLog: idType.sorted('gwlg_'),
  connectionCheck: idType.sorted('gwcc_')
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
