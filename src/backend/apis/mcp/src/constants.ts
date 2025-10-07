export let CONNECTION_TYPES = ['sse', 'websocket', 'streamable_http'] as const;
export let CONNECTION_TYPE_ALIASES: {
  [K in (typeof CONNECTION_TYPES)[number]]: [K, ...string[]];
} = {
  sse: ['sse', 'server-sent-events', 'server_sent_events', '2024-11-05', '2024_11_05'],
  streamable_http: [
    'streamable_http',
    'streamable-http',
    'http',
    '2025-03-26',
    '2025_03_26',
    '2025-06-18',
    '2025_06_18',
    'mcp'
  ],
  websocket: ['websocket', 'ws']
};
export let ALIAS_TO_CONNECTION_TYPE = new Map(
  Object.entries(CONNECTION_TYPE_ALIASES).flatMap(([key, value]) =>
    value.map(v => [v, key] as [string, (typeof CONNECTION_TYPES)[number]])
  )
);

export let ALL_CONNECTION_TYPES = new Set([
  ...Object.values(CONNECTION_TYPE_ALIASES).flatMap(v => v),
  ...CONNECTION_TYPES
]);

export let toConnectionType = (input: string): (typeof CONNECTION_TYPES)[number] | null => {
  let type = ALIAS_TO_CONNECTION_TYPE.get(input.toLowerCase());
  if (!type) return null;
  return type;
};
