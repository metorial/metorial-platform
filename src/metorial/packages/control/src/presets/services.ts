export interface ServiceDefinition {
  port: number;
  url(path?: string): string;
  wsUrl(path?: string): string;
  host(): string;
}

let service = (port: number): ServiceDefinition => ({
  port,
  url: (path = '') => `http://{{HOSTNAME}}:${port}${path}`,
  wsUrl: (path = '') => `ws://{{HOSTNAME}}:${port}${path}`,
  host: () => `{{HOSTNAME}}:${port}`
});

export let services = {
  adminFrontend: service(3103),
  dashboard: service(4300),
  shellFrontend: service(4301),
  coreApi: service(4310),
  marketplaceApi: service(4312),
  portalApi: service(4315),
  integrationsApi: service(4316),
  subspaceInternal: service(4317),
  files: service(4318),
  checkout: service(4320),
  federation: service(4321),
  adminApi: service(4322),
  multiRegion: service(4323),
  aresCallback: service(4324),
  hyperplane: service(4330),
  shell: service(4333),
  explorerV2: service(4350),
  apiExplorer: service(4351),
  explorer: service(6050),
  objectStorage: service(52010),
  functionBay: service(52030),
  slatesRegistryInternal: service(52041),
  slatesHubPublic: service(52045),
  slatesHub: service(52046),
  signal: service(52050),
  voyager: service(52060),
  integrationsUi: service(52071),
  shuttle: service(52080),
  shuttlePublic: service(52081),
  origin: service(52090),
  relay: service(52110),
  aresAuth: service(52120),
  aresInternal: service(52123),
  horizonAuth: service(52130),
  horizonOutpost: service(52131),
  horizonHelm: service(52132),
  horizonHyperplane: service(52133),
  horizonPassportHome: service(52134),
  horizonSupport: service(52136),
  horizonOctane: service(52137),
  horizonPassport: service(52138),
  horizonCounselor: service(52140),
  horizonComms: service(52141),
  horizonLedgerAdmin: service(52143),
  horizonLedgerPublic: service(52144),
  horizonPadd: service(52145),
  horizonLicenseApi: service(52147),
  horizonKeeperAdmin: service(52148),
  horizonCustomerFirehose: service(52146),
  synthesis: service(52160),
  nebula: service(52170),
  agentTracking: service(52180),
  agentTrackingIngest: service(52181)
};
