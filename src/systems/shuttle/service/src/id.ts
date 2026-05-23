import { createIdGenerator, idType } from '@mtsrc/id';
import { Snowflake } from '@mtsrc/snowflake';

export let ID = createIdGenerator({
  tenant: idType.sorted('ctn_'),
  secret: idType.sorted('cse_'),

  registry: idType.sorted('crg_'),
  repository: idType.sorted('crp_'),
  repositoryTag: idType.sorted('crt_'),
  repositoryVersion: idType.sorted('crv_'),
  repositoryTagDiscoveryError: idType.sorted('ctd_'),

  serverConfig: idType.sorted('csi_'),
  serverConnection: idType.sorted('csc_'),
  serverDiscovery: idType.sorted('csd_'),
  serverSpecification: idType.sorted('css_'),
  server: idType.sorted('csr_'),
  serverVersion: idType.sorted('csv_'),

  changeNotification: idType.sorted('ccn_'),

  remoteOAuthConfig: idType.sorted('csoc_'),
  remoteOAuthConnection: idType.sorted('cso_'),
  remoteOAuthConnectionTemplate: idType.sorted('csot_'),
  remoteOAuthDiscoveryDocument: idType.sorted('csod_'),
  remoteOAuthAutoRegistration: idType.sorted('csoar_'),
  remoteOAuthRegistrationError: idType.sorted('csore_'),
  remoteOAuthConnectionEvent: idType.sorted('csoce_'),
  remoteOAuthConnectionSetup: idType.sorted('csoaat_'),
  remoteOAuthConnectionProfile: idType.sorted('csoap_'),
  remoteOAuthConnectionAuthToken: idType.sorted('csoat_'),
  remoteOAuthConnectionAuthTokenError: idType.sorted('csoate_'),

  serverAuthConfig: idType.sorted('csac_'),
  serverAuthConfigEvent: idType.sorted('csace_'),
  serverOAuthSetup: idType.sorted('csos_'),
  serverOAuthSetupEvent: idType.sorted('csose_'),
  serverOAuthCredentials: idType.sorted('csocd_'),

  networkingRuleset: idType.sorted('cnr_'),

  deploymentProvider: idType.sorted('cdp_'),

  functionServer: idType.sorted('cfs_'),
  upcomingFunctionServer: idType.sorted('cufs_'),

  delegatedOAuthConfig: idType.sorted('cdoc_'),
  delegatedOAuthConnection: idType.sorted('cdo_'),
  delegatedOAuthConnectionEvent: idType.sorted('cdoce_'),
  delegatedOAuthConnectionSetup: idType.sorted('cdocs_'),
  delegatedOAuthConnectionAuthToken: idType.sorted('cdoat_'),
  delegatedOAuthConnectionAuthTokenError: idType.sorted('cdoate_'),

  serverDeployment: idType.sorted('csde_'),
  serverDeploymentStep: idType.sorted('csds_')
});

let workerIdBits = 16;
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
  sequenceBits: 5,
  epoch: new Date('2025-06-01T00:00:00Z')
});

export let getId = <K extends Parameters<typeof ID.generateIdSync>[0]>(model: K) => ({
  oid: snowflake.nextId(),
  id: ID.generateIdSync(model)
});
