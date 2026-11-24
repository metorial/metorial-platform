import { createIdGenerator, idType } from '@lowerdeck/id';
import { Snowflake } from '@lowerdeck/snowflake';

// New organizations, projects and instances take their core Metorial id (the ref) as id.
export let ID = createIdGenerator({
  gatewayToken: idType.sorted('agtk_'),
  catalogSync: idType.sorted('agcs_'),
  lab: idType.sorted('aglb_'),
  provider: idType.sorted('agpv_'),
  model: idType.sorted('agmd_'),
  modelOffering: idType.sorted('agof_'),
  modelAlias: idType.sorted('agma_'),
  providerConnection: idType.sorted('agpc_'),
  inferenceLog: idType.sorted('aglg_'),
  connectionCheck: idType.sorted('agcc_'),
  virtualModel: idType.sorted('agvm_'),
  virtualModelVersion: idType.sorted('agvv_'),
  billingWindow: idType.sorted('agbw_')
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
