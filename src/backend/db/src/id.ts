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
  secretEvent: idType.sorted('sce'),

  importedServerVendor: idType.sorted('iven'),
  importedServer: idType.sorted('isrv'),
  importedRepository: idType.sorted('irep'),

  serverListing: idType.sorted('sli'),
  serverListingCategory: idType.sorted('slca'),
  serverListingCollection: idType.sorted('slco'),
  serverListingUpdate: idType.sorted('slup'),

  serverConfigSchema: idType.sorted('scs'),
  serverVariantProvider: idType.sorted('svp'),

  server: idType.sorted('srv'),
  serverVariant: idType.sorted('sva'),
  serverVersion: idType.sorted('sve'),

  serverImplementation: idType.sorted('svi'),
  serverDeployment: idType.sorted('svd'),
  serverDeploymentConfig: idType.sorted('svdc'),

  serverRunner: idType.sorted('sru'),

  sessionMessage: idType.sorted('msg'),
  sessionEvent: idType.sorted('sev'),
  session: idType.sorted('ses'),
  sessionConnection: idType.sorted('sco'),
  serverSession: idType.sorted('srs'),
  serverRun: idType.sorted('srr'),
  serverRunErrorGroup: idType.sorted('sreg'),
  serverRunError: idType.sorted('sre'),
  serverAutoDiscoveryJob: idType.sorted('sadj'),
  serverOAuthSession: idType.sorted('soas'),
  serverOAuthSession_ClientSecret: idType.unsorted('soas_sec', 50),
  sessionServerDeployment: idType.sorted('ssd'),

  instanceServer: idType.sorted('isv'),

  profile: idType.sorted('prf'),
  profileUpdate: idType.sorted('prfu'),

  clientSecret: idType.sorted('cse'),

  oauthConnectionTemplate: idType.sorted('poct'),
  oauthConnection: idType.sorted('poc'),
  oauthConnectionProfile: idType.sorted('pocp'),
  oauthConnectionAuthAttempt: idType.sorted('poca'),
  oauthConnectionAuthAttempt_State: idType.unsorted('poca_state'),
  oauthConnectionAuthAttempt_ClientSecret: idType.unsorted('poca_sec', 50),
  oauthConnectionAuthToken: idType.sorted('potk'),
  oauthDiscoveryDocument: idType.sorted('pod'),
  oauthConnectionEvent: idType.sorted('poce'),
  oauthAutoRegistration: idType.sorted('poar'),
  oauthConfig: idType.sorted('pocf'),
  providerOAuthRegistrationError: idType.sorted('pore'),
  providerOAuthTakeout: idType.sorted('poto'),

  customServer: idType.sorted('csv'),
  customServerVersion: idType.sorted('csvv'),
  customServerEvent: idType.sorted('csvev'),
  customServerDeployment: idType.sorted('csd'),
  customServerDeploymentStep: idType.sorted('csds'),
  lambdaServerInstance: idType.sorted('lsi'),
  managedServerTemplate: idType.sorted('mst'),
  remoteServerInstance: idType.sorted('rsi'),

  codeBucket: idType.sorted('cbu'),
  codeBucketTemplate: idType.sorted('cbt'),

  magicMcpServer: idType.sorted('mgsr'),
  magicMcpSession: idType.sorted('mgsn'),
  magicMcpToken: idType.sorted('mgtk'),
  magicMcpServerDeployment: idType.sorted('mgsrd'),

  scmInstallation: idType.sorted('sci'),
  scmAccount: idType.sorted('sca'),
  scmRepo: idType.sorted('scr'),
  scmRepoWebhook: idType.sorted('scrw'),
  scmRepoPush: idType.sorted('scmp'),

  callback: idType.sorted('clb'),
  callbackHook: idType.sorted('cbh'),
  callbackTemplate: idType.sorted('clt'),
  callbackEvent: idType.sorted('cbe'),
  callbackSchedule: idType.sorted('cbs'),
  callbackEventProcessingAttempt: idType.sorted('cbep'),
  callbackPollingAttempt: idType.sorted('cbpa'),
  callbackInstallation: idType.sorted('cbi'),
  callbackNotification: idType.sorted('cbn'),
  callbackNotificationAttempt: idType.sorted('cbna'),
  callbackDestination: idType.sorted('cld')
});
