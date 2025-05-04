import { createIdGenerator, idType } from '@metorial/id';

export let ID = createIdGenerator({
  emailIdentity: idType.sorted('eid'),
  email: idType.sorted('eml')
});
