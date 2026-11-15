import { createIdGenerator, idType } from '@lowerdeck/id';
import { Snowflake } from '@lowerdeck/snowflake';

export let ID = createIdGenerator({
  emailIdentity: idType.sorted('eid'),
  outgoingEmail: idType.sorted('oe'),
  outgoingEmailDestination: idType.sorted('oed'),
  outgoingEmailSend: idType.sorted('oes'),
  sender: idType.sorted('es')
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

export let get4ByteIntId = (): number => {
  let buffer = new Int32Array(1);
  crypto.getRandomValues(buffer);
  return buffer[0]!;
};
