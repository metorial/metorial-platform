export type ExplorerTransport = 'sse' | 'streamable_http';

export type ExplorerConnectionInput = Pick<
  ParsedConnectionParams,
  'name' | 'url' | 'token' | 'transport' | 'description'
>;

export type ParsedConnectionParams = {
  name: string;
  url: string;
  token?: string;
  transport: ExplorerTransport;
  errors: string[];
  description?: string;
};

export let normalizeTransport = (transport?: string | null): ExplorerTransport | undefined => {
  let normalized = transport?.trim().toLowerCase();

  if (normalized === 'streamable-http') return 'streamable_http';
  if (normalized === 'streamable_http') return 'streamable_http';
  if (normalized === 'sse') return 'sse';

  return undefined;
};

export let normalizeConnectionParams = (
  connection: ExplorerConnectionInput
): ParsedConnectionParams => {
  let name = connection.name?.trim() || 'MCP Provider';
  let url = connection.url?.trim() || '';
  let token = connection.token?.trim() || undefined;
  let transport = normalizeTransport(connection.transport);
  let description = connection.description?.trim() || undefined;
  let errors: string[] = [];

  if (!url) {
    errors.push('Missing required MCP endpoint URL.');
  } else {
    try {
      new URL(url);
    } catch {
      errors.push('The MCP endpoint URL is not a valid absolute URL.');
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
