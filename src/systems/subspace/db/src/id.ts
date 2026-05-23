import { createIdGenerator, idType } from '@mtsrc/id';
import { Snowflake } from '@mtsrc/snowflake';

export let ID = createIdGenerator({
  tenant: idType.sorted('ktn'),
  solution: idType.sorted('kso'),
  environment: idType.sorted('ken'),
  backend: idType.sorted('kbe'),
  brand: idType.sorted('kbr'),
  tenantActor: idType.sorted('pact'),
  tenantOAuthCallbackUrl: idType.sorted('cbu'),

  publisher: idType.sorted('pub'),

  providerVariant: idType.sorted('pvr'),
  provider: idType.sorted('pro'),
  providerEntry: idType.sorted('pre'),
  providerVersion: idType.sorted('prv'),
  providerType: idType.sorted('pty'),

  providerListing: idType.sorted('plg'),
  providerListingUpdate: idType.sorted('plu'),
  providerCategory: idType.sorted('pca'),
  providerCollection: idType.sorted('pco'),
  providerGroup: idType.sorted('pgr'),

  environmentProvider: idType.sorted('kep'),

  providerEnvironment: idType.sorted('pen'),
  providerEnvironmentVersion: idType.sorted('pev'),

  providerDeployment: idType.sorted('pde'),
  providerDeploymentVersion: idType.sorted('pdv'),

  providerConfig: idType.sorted('pcf'),
  providerConfigVersion: idType.sorted('pcv'),
  providerConfigUpdate: idType.sorted('pcu'),
  providerConfigVault: idType.sorted('pcvt'),

  providerDeploymentConfigPair: idType.sorted('pdcp'),
  providerDeploymentConfigPairProviderVersion: idType.sorted('pdcpv'),

  providerVersionSpecificationChange: idType.sorted('pvsc'),
  providerSpecificationChangeNotification: idType.sorted('pscn'),
  providerDeploymentConfigPairSpecificationChange: idType.sorted('pdcpsc'),
  providerDeploymentConfigPairDiscovery: idType.sorted('pdcpd'),

  providerUse: idType.sorted('pus'),
  providerTag: idType.sorted('kpt'),

  providerSpecification: idType.sorted('psp'),
  providerTool: idType.sorted('pto'),
  providerToolGlobal: idType.sorted('ptog'),
  providerAuthMethod: idType.sorted('pam'),
  providerAuthMethodGlobal: idType.sorted('pamg'),
  providerTrigger: idType.sorted('ptr'),
  providerTriggerGlobal: idType.sorted('ptrg'),

  providerAuthCredentials: idType.sorted('par'),
  managedProviderAuthCredentials: idType.sorted('pmac'),
  providerAuthConfig: idType.sorted('pac'),
  providerAuthConfigVersion: idType.sorted('pacv'),
  providerAuthConfigEvent: idType.sorted('pacev'),
  providerAuthConfigError: idType.sorted('paerr'),
  providerAuthConfigErrorGlobal: idType.sorted('paerg'),
  providerOAuthSetup: idType.sorted('poas'),
  providerOAuthSetup_clientSecret: idType.key('poas_secret'),
  providerAuthConfigUpdate: idType.sorted('pacu'),
  providerSetupSession: idType.sorted('pas'),
  providerSetupSession_clientSecret: idType.key('pas_secret'),
  providerSetupSessionEvent: idType.sorted('pase'),

  providerAuthImport: idType.sorted('paci'),
  providerAuthExport: idType.sorted('pace'),

  providerAuthConfigUsedForConfig: idType.sorted('pacufc'),
  providerAuthConfigUsedForDeployment: idType.sorted('pacufd'),

  customProvider: idType.sorted('cpr'),
  customProviderCommit: idType.sorted('cpc'),
  customProviderVersion: idType.sorted('cpv'),
  customProviderDeployment: idType.sorted('cpd'),
  customProviderEnvironment: idType.sorted('cpe'),
  customProviderEnvironmentVersion: idType.sorted('cpev'),
  upcomingCustomProvider: idType.sorted('ucp'),

  session: idType.sorted('ses'),
  ephemeralManagedSession: idType.sorted('ems'),
  sessionTemplate: idType.sorted('set'),
  sessionTemplateProvider: idType.sorted('stp'),
  sessionProvider: idType.sorted('spv'),
  sessionProviderInstance: idType.sorted('spi'),
  sessionMessage: idType.sorted('smg'),
  sessionMessage_mcp: idType.sorted('smg_mcp'),
  sessionParticipant: idType.sorted('spar'),
  sessionEvent: idType.sorted('sev'),
  sessionClientConnection: idType.sorted('scc'),
  sessionConnection: idType.sorted('scon'),
  sessionConnection_token: idType.unsorted('scon_tok', 30),
  sessionError: idType.sorted('serr'),
  sessionErrorGroup: idType.sorted('serg'),
  sessionWarning: idType.sorted('swarn'),

  providerRun: idType.sorted('prun'),

  callbackDestination: idType.sorted('cbd'),
  callback: idType.sorted('cbk'),
  callbackInstance: idType.sorted('cbi'),
  callbackProviderTrigger: idType.sorted('cbpt'),
  callbackReceiverRegistration: idType.sorted('cbrr'),

  toolCall: idType.sorted('tcl'),
  toolCallAttachment: idType.sorted('tca'),

  identityActor: idType.sorted('iac'),
  identity: idType.sorted('idn'),
  identityCredential: idType.sorted('icr'),
  identityCredentialVersion: idType.sorted('icrv'),
  identityDelegation: idType.sorted('ide'),
  identityDelegationRequest: idType.sorted('idr'),
  identityDelegationConfig: idType.sorted('idc'),
  identityDelegationConfigVersion: idType.sorted('idcv'),
  identityDelegationParty: idType.sorted('idp'),
  identityDelegationAttestation: idType.sorted('ida'),
  delegatedIdentity: idType.sorted('did'),
  delegatedIdentityCredential: idType.sorted('dcr'),
  delegatedIdentityUpdate: idType.sorted('diu'),
  delegatedIdentityUpdateCredential: idType.sorted('diuc'),
  identityDelegationCredentialOverride: idType.sorted('idco'),
  agent: idType.sorted('agt'),
  agentClient: idType.sorted('agc'),
  agentClientRegistration: idType.sorted('agr'),
  agentInstance: idType.sorted('agi'),

  integration: idType.sorted('int'),
  integrationInstanceGroup: idType.sorted('dii'),
  integrationInstanceGroupSource: idType.sorted('dis'),
  integrationInstanceGroupProvider: idType.sorted('dip'),
  integrationInstance: idType.sorted('ini'),
  integrationInstanceProvider: idType.sorted('iip'),
  integrationInstanceProviderVersion: idType.sorted('iiv'),
  integrationProvider: idType.sorted('inp'),
  magicMcpServerProvider: idType.sorted('msp'),
  integrationProviderVersion: idType.sorted('ipv'),
  integrationVersion: idType.sorted('inv'),
  integrationVersionProvider: idType.sorted('ivp'),
  integrationSetupSession: idType.sorted('iss'),
  integrationSetupSession_clientSecret: idType.key('iss_secret'),
  integrationSetupSessionProvider: idType.sorted('isp'),
  integrationSetupSessionStep: idType.sorted('isst'),
  integrationSetupSessionEvent: idType.sorted('ise'),

  skillEntity: idType.sorted('ske'),
  skill: idType.sorted('skl'),
  skillFork: idType.sorted('skf'),
  skillGroup: idType.sorted('skg'),
  skillGroupItem: idType.sorted('skgi'),
  skillTemplate: idType.sorted('skt'),
  skillTemplateItem: idType.sorted('skti'),
  skillItem: idType.sorted('ski'),
  skillIntegration: idType.sorted('skn'),
  skillProvider: idType.sorted('skp'),
  skillProviderLink: idType.sorted('skpl')
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
