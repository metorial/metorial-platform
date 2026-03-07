export type ExplorerTransport = 'sse' | 'streamable_http';

export type ExplorerConfigPayload = {
  transport_type: 'sse' | 'streamable-http';
  sse_url: string;
  bearer_token?: string;
  name?: string;
  description?: string;
};

export type ExplorerConfigMessage = {
  type: 'metorial.explorer.config';
  payload: ExplorerConfigPayload;
};

export type ExplorerConnectionOverrides = Partial<
  Pick<ParsedConnectionParams, 'name' | 'url' | 'token' | 'transport' | 'description'>
>;

export type ParsedConnectionParams = {
  name: string;
  url: string;
  token?: string;
  transport: ExplorerTransport;
  errors: string[];
  description?: string;
};

let normalizeTransport = (transport?: string | null): ExplorerTransport | undefined => {
  let normalized = transport?.trim().toLowerCase();

  if (normalized === 'streamable-http') return 'streamable_http';
  if (normalized === 'streamable_http') return 'streamable_http';
  if (normalized === 'sse') return 'sse';

  return undefined;
};

export let getConnectionOverridesFromConfig = (
  message: ExplorerConfigMessage
): ExplorerConnectionOverrides => ({
  name: message.payload.name?.trim() || undefined,
  description: message.payload.description?.trim() || undefined,
  url: message.payload.sse_url?.trim() || undefined,
  token: message.payload.bearer_token?.trim() || undefined,
  transport: normalizeTransport(message.payload.transport_type)
});

export let isExplorerConfigMessage = (value: unknown): value is ExplorerConfigMessage => {
  if (!value || typeof value !== 'object') return false;

  let candidate = value as Partial<ExplorerConfigMessage>;

  return (
    candidate.type === 'metorial.explorer.config' &&
    !!candidate.payload &&
    typeof candidate.payload === 'object' &&
    typeof (candidate.payload as Partial<ExplorerConfigPayload>).sse_url === 'string' &&
    typeof (candidate.payload as Partial<ExplorerConfigPayload>).transport_type === 'string'
  );
};

export let getConnectionParams = (
  search: string,
  overrides?: ExplorerConnectionOverrides
): ParsedConnectionParams => {
  let params = new URLSearchParams(search);

  let name = overrides?.name ?? (params.get('name')?.trim() || 'MCP Provider');
  let url = overrides?.url ?? ((params.get('endpoint') ?? params.get('url'))?.trim() || '');
  let token = overrides?.token ?? (params.get('token')?.trim() || undefined);
  let transport = overrides?.transport ?? normalizeTransport(params.get('transport'));
  let description = overrides?.description ?? (params.get('description')?.trim() || undefined);

  let errors: string[] = [];

  if (!url) {
    errors.push('Missing required endpoint or url query parameter.');
  } else {
    try {
      new URL(url);
    } catch {
      errors.push('The endpoint or url query parameter is not a valid absolute URL.');
    }
  }

  if (transport !== 'sse' && transport !== 'streamable_http') {
    errors.push('The transport query parameter must be either sse or streamable_http.');
    transport = 'streamable_http';
  }

  return {
    name,
    url,
    token,
    transport,
    errors,
    description
  };
};
