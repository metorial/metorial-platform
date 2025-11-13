import { createIdGenerator, idType } from '@metorial/id';

export let ID = createIdGenerator({
  tenant: idType.sorted('sten'),
  tenant_clientId: idType.key('sten_client', 50),

  connection: idType.sorted('scon'),

  setup: idType.sorted('scsu'),
  setup_clientSecret: idType.key('scsu_sec', 50),

  userProfile: idType.sorted('supr'),
  user: idType.sorted('susr'),

  authorization: idType.sorted('saut'),
  authorization_code: idType.key('saut_code', 50)
});
