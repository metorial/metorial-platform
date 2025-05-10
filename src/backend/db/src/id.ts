import { createIdGenerator, idType } from '@metorial/id';

export let ID = createIdGenerator({
  emailIdentity: idType.sorted('eid'),
  email: idType.sorted('eml'),

  user: idType.sorted('usr'),
  userSession: idType.sorted('uss'),

  organization: idType.sorted('org'),
  organizationMember: idType.sorted('ome'),
  organizationInvite: idType.sorted('oin'),
  organizationActor: idType.sorted('oac'),
  organizationInviteJoin: idType.sorted('oij'),

  project: idType.sorted('prj'),
  instance: idType.sorted('ins'),

  machineAccess: idType.sorted('mac'),
  apiKey: idType.sorted('apk'),
  apiKeySecret: idType.sorted('aks'),
  apiApplication: idType.sorted('aap'),

  filePurpose: idType.sorted('fpu'),
  file: idType.sorted('fil'),
  fileLink: idType.sorted('fil'),

  secretType: idType.sorted('sty'),
  secret: idType.sorted('sec'),
  secretStore: idType.sorted('sst'),
  secretEvent: idType.sorted('sev')
});
