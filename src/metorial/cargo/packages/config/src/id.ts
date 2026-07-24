import { Snowflake } from '@lowerdeck/snowflake';
import { ID } from '@metorial/db';
import { generatePlainId } from '@metorial/id';

let workerIdBits = 12;
let workerIdMask = (1 << workerIdBits) - 1;
let workerId = crypto.getRandomValues(new Uint16Array(1))[0]! & workerIdMask;

export let snowflake = new Snowflake({
  workerId,
  datacenterId: 0,
  workerIdBits,
  datacenterIdBits: 0,
  sequenceBits: 9,
  epoch: new Date('2025-06-01T00:00:00Z')
});

export let getId = (model: Parameters<typeof ID.generateIdSync>[0] | 'documentContent') => ({
  oid: snowflake.nextId(),
  id: model === 'documentContent' ? `docn_${generatePlainId(24)}` : ID.generateIdSync(model)
});
