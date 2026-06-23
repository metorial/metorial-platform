import { createIdGenerator, idType } from '@lowerdeck/id';
import { Snowflake } from '@lowerdeck/snowflake';

export let ID = createIdGenerator({
  tenant: idType.sorted('srtn'),
  scope: idType.sorted('srsc'),
  user: idType.sorted('srus'),
  workspace: idType.sorted('srws'),
  userToken: idType.sorted('srutk'),
  readerToken: idType.sorted('srrtk'),
  slate: idType.sorted('srsl'),
  slateVersion: idType.sorted('srsv'),
  slateDocument: idType.sorted('srsd'),
  artifact: idType.sorted('sraf'),
  changeNotification: idType.sorted('srcn'),
  subRegistry: idType.sorted('srsr'),
  subRegistryFilter: idType.sorted('srsf'),
  slateCategory: idType.sorted('srct'),
  adminUser: idType.sorted('srau'),
  adminSession: idType.sorted('sras')
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
