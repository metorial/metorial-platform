export type OutpostServiceName = 'mcp_connection_proxy' | 'outpost_registration_proxy';

export let OUTPOST_SERVICES: [OutpostServiceName, ...OutpostServiceName[]] = [
  'mcp_connection_proxy',
  'outpost_registration_proxy'
];
