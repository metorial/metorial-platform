let protocolHeaders = [
  'authorization',
  'mcp-session-id',
  'mcp-protocol-version',
  'mcp-method',
  'mcp-name',
  'last-event-id'
];

export let publicMcpBrowserVary = 'User-Agent, Accept, Sec-Fetch-Mode, Sec-Fetch-Dest';

export let isPublicMcpBrowserRequest = (request: Request) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') return false;
  if (protocolHeaders.some(header => request.headers.has(header))) return false;
  if (new URL(request.url).searchParams.has('connection_token')) return false;

  let userAgent = request.headers.get('user-agent') ?? '';
  if (!/^Mozilla\/5\.0\b/.test(userAgent)) return false;
  if (!/(AppleWebKit|Gecko)\//.test(userAgent)) return false;

  let mode = request.headers.get('sec-fetch-mode');
  let destination = request.headers.get('sec-fetch-dest');
  if (mode && mode !== 'navigate') return false;
  if (destination && destination !== 'document') return false;

  let acceptedTypes = (request.headers.get('accept') ?? '').split(',').map(value => {
    let [type, ...parameters] = value.trim().toLowerCase().split(';');
    let quality = parameters.find(parameter => parameter.trim().startsWith('q='));

    return {
      type,
      quality: quality ? Number(quality.trim().slice(2)) : 1
    };
  });

  if (acceptedTypes.some(value => value.type === 'text/event-stream' && value.quality > 0)) {
    return false;
  }

  return acceptedTypes.some(value => value.type === 'text/html' && value.quality > 0);
};
