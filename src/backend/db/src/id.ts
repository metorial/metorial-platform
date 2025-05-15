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
  fileLink: idType.sorted('flk'),

  secretType: idType.sorted('sty'),
  secret: idType.sorted('sec'),
  secretStore: idType.sorted('sst'),
  secretEvent: idType.sorted('sev'),

  importedServerVendor: idType.sorted('iven'),
  importedServer: idType.sorted('isrv'),
  importedRepository: idType.sorted('irep'),

  serverListing: idType.sorted('sli'),
  serverListingCategory: idType.sorted('slca'),
  serverListingCollection: idType.sorted('slco'),

  serverConfig: idType.sorted('sco'),
  serverVariantProvider: idType.sorted('svp'),

  server: idType.sorted('srv'),
  serverVariant: idType.sorted('sva'),
  serverVersion: idType.sorted('sve'),

  serverInstance: idType.sorted('svi'),
  serverDeployment: idType.sorted('svd'),

  serverRunner: idType.sorted('sru'),

  sessionMessage: idType.sorted('msg'),
  session: idType.sorted('ses'),
  serverSession: idType.sorted('srs'),
  serverRun: idType.sorted('srr'),

  profile: idType.sorted('prf')
});
