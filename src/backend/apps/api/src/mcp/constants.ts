export let CONNECTION_TYPES = ['sse', 'websocket', 'streamable_http'] as const;
export let CONNECTION_TYPE_ALIASES: {
  [K in (typeof CONNECTION_TYPES)[number]]: [K, ...string[]];
} = {
  sse: ['sse', 'server-sent-events', '2024-11-05'],
  streamable_http: ['streamable_http', 'streamable-http', 'http', '2025-03-26'],
  websocket: ['websocket', 'ws']
};
export let ALIAS_TO_CONNECTION_TYPE = new Map(
  Object.entries(CONNECTION_TYPE_ALIASES).flatMap(([key, value]) =>
    value.map(v => [v, key] as [string, (typeof CONNECTION_TYPES)[number]])
  )
);
