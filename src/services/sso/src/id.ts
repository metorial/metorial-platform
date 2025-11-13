import { createIdGenerator, idType } from '@metorial/id';

export let ID = createIdGenerator({
  tenant: idType.sorted('sten'),
  tenant_clientId: idType.key('sten_client', 50),

  connection: idType.sorted('scon'),

  setup: idType.sorted('scsu'),
  setup_clientSecret: idType.key('scsu_sec', 50),

  userProfile: idType.sorted('supr'),
  user: idType.sorted('susr'),

  auth: idType.sorted('saut'),
  auth_clientSecret: idType.key('saut_code', 50)
});
