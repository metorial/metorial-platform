import { createIdGenerator, idType } from '@lowerdeck/id';
import { Snowflake } from '@lowerdeck/snowflake';

export let ID = createIdGenerator({
  tenant: idType.sorted('ntn_'),
  keyProvider: idType.sorted('nkp_'),
  key: idType.sorted('nkey_'),
  keyError: idType.sorted('nker_'),
  secret: idType.sorted('nsec_'),
  secretVersion: idType.sorted('nsv_'),
  secretUse: idType.sorted('nsu_'),
  consumer: idType.sorted('ncon_')
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
  workerIdBits,
  datacenterIdBits: 0,
  sequenceBits: 9,
  epoch: new Date('2025-06-01T00:00:00Z')
});
