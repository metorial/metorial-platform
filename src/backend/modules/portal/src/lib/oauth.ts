import { badRequestError, ServiceError } from '@lowerdeck/error';

export type PortalAllowedRedirectUrlFilter = {
  url: string;
};

export let defaultPortalAllowedRedirectUrlFilters: PortalAllowedRedirectUrlFilter[] = [
  { url: 'http://localhost:*/*' },
  { url: 'http://*.localhost:*/*' },
  { url: 'https://*/*' },
  { url: '*://*' }
];

type ParsedPortalAllowedRedirectUrlFilter = {
  protocol: string;
  hostname: string;
  port?: string;
  path?: string;
};

let portalAllowedRedirectUrlFilterPattern =
  /^(?<protocol>\*|[a-z][a-z0-9+.-]*):\/\/(?<authority>[^/?#]+)(?<path>\/[^?#]*)?$/i;

export let urlsMatch = (url1: string, url2: string) => {
  try {
    let u1 = new URL(url1);
    let u2 = new URL(url2);

    return (
      u1.protocol == u2.protocol &&
      u1.hostname == u2.hostname &&
      u1.port == u2.port &&
      u1.pathname == u2.pathname
    );
  } catch {
    return false;
  }
};

let escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

let splitPortalAllowedRedirectUrlFilterAuthority = (authority: string) => {
  if (authority == '*') {
    return { hostname: '*', port: undefined as string | undefined };
  }

  let ipv6Match = authority.match(/^\[(?<hostname>[^\]]+)\](?::(?<port>\*|\d+))?$/);
  if (ipv6Match?.groups) {
    return {
      hostname: `[${ipv6Match.groups.hostname}]`,
      port: ipv6Match.groups.port
    };
  }

  let lastColonIndex = authority.lastIndexOf(':');
  if (lastColonIndex == -1) {
    return { hostname: authority, port: undefined as string | undefined };
  }

  let hostname = authority.slice(0, lastColonIndex);
  let port = authority.slice(lastColonIndex + 1);
  if (port == '*' || /^\d+$/.test(port)) {
    return { hostname, port };
  }

  return { hostname: authority, port: undefined as string | undefined };
};

let parsePortalAllowedRedirectUrlFilter = (
  value: string,
  field: string
): ParsedPortalAllowedRedirectUrlFilter => {
  let match = value.match(portalAllowedRedirectUrlFilterPattern);
  if (!match?.groups) {
    throw new ServiceError(
      badRequestError({
        message: `${field} must be a valid redirect URL pattern`
      })
    );
  }

  let { hostname, port } = splitPortalAllowedRedirectUrlFilterAuthority(
    match.groups.authority
  );
  if (hostname.length == 0) {
    throw new ServiceError(
      badRequestError({
        message: `${field} must include a hostname pattern`
      })
    );
  }

  if (hostname != '*' && hostname.includes('*') && !hostname.startsWith('*.')) {
    throw new ServiceError(
      badRequestError({
        message: `${field} contains an unsupported hostname wildcard`
      })
    );
  }

  if (hostname.startsWith('*.') && hostname.slice(2).includes('*')) {
    throw new ServiceError(
      badRequestError({
        message: `${field} contains an unsupported hostname wildcard`
      })
    );
  }

  if (port && port != '*' && !/^\d+$/.test(port)) {
    throw new ServiceError(
      badRequestError({
        message: `${field} contains an invalid port pattern`
      })
    );
  }

  return {
    protocol: match.groups.protocol.toLowerCase(),
    hostname: hostname.toLowerCase(),
    port,
    path: match.groups.path
  };
};

let matchesPortalAllowedRedirectUrlFilterProtocol = (
  protocolPattern: string,
  protocol: string
) => {
  if (protocolPattern == '*') {
    return protocol != 'http' && protocol != 'https';
  }

  return protocolPattern == protocol;
};

let matchesPortalAllowedRedirectUrlFilterHostname = (
  hostnamePattern: string,
  hostname: string
) => {
  if (hostnamePattern == '*') return true;
  if (hostnamePattern.startsWith('*.')) {
    let suffix = hostnamePattern.slice(2);
    return hostname.length > suffix.length && hostname.endsWith(`.${suffix}`);
  }

  return hostnamePattern == hostname;
};

let matchesPortalAllowedRedirectUrlFilterPort = (
  portPattern: string | undefined,
  port: string
) => {
  if (!portPattern) return port.length == 0;
  if (portPattern == '*') return true;

  return portPattern == port;
};

let matchesPortalAllowedRedirectUrlFilterPath = (
  pathPattern: string | undefined,
  path: string
) => {
  if (!pathPattern) return true;
  if (pathPattern == '/*') return path.length == 0 || path.startsWith('/');

  let regexSource = escapeRegex(pathPattern)
    .replace(/\\\/\\\*$/g, '(?:\\/.*)?')
    .replace(/\\\*/g, '.*');

  return new RegExp(`^${regexSource}$`).test(path);
};

export let validateUrlString = (value: string, field: string) => {
  try {
    new URL(value);
  } catch {
    throw new ServiceError(
      badRequestError({
        message: `${field} must be a valid URL`,
        oauth: {
          error: 'invalid_request',
          errorMessage: `${field} must be a valid URL`
        }
      })
    );
  }
};

export let getPortalAllowedRedirectUrlFilters = (
  filters?: PortalAllowedRedirectUrlFilter[] | null
): PortalAllowedRedirectUrlFilter[] => {
  return filters ?? defaultPortalAllowedRedirectUrlFilters;
};

export let validatePortalAllowedRedirectUrlFilters = (
  filters: PortalAllowedRedirectUrlFilter[],
  field = 'allowed_redirect_url_filters'
) => {
  for (let [index, filter] of filters.entries()) {
    if (!filter?.url) {
      throw new ServiceError(
        badRequestError({
          message: `${field}[${index}].url is required`
        })
      );
    }

    parsePortalAllowedRedirectUrlFilter(filter.url, `${field}[${index}].url`);
  }
};

export let portalAllowedRedirectUrlFilterMatches = (
  filter: PortalAllowedRedirectUrlFilter,
  redirectUri: string
) => {
  validateUrlString(redirectUri, 'redirect_uri');

  let parsedFilter = parsePortalAllowedRedirectUrlFilter(
    filter.url,
    'allowed_redirect_url_filters.url'
  );
  let redirectUrl = new URL(redirectUri);

  return (
    matchesPortalAllowedRedirectUrlFilterProtocol(
      parsedFilter.protocol,
      redirectUrl.protocol.replace(/:$/, '').toLowerCase()
    ) &&
    matchesPortalAllowedRedirectUrlFilterHostname(
      parsedFilter.hostname,
      redirectUrl.hostname.toLowerCase()
    ) &&
    matchesPortalAllowedRedirectUrlFilterPort(parsedFilter.port, redirectUrl.port) &&
    matchesPortalAllowedRedirectUrlFilterPath(parsedFilter.path, redirectUrl.pathname)
  );
};

export let validatePortalRedirectUrisAgainstAllowedFilters = (d: {
  redirectUris: string[];
  allowedRedirectUrlFilters?: PortalAllowedRedirectUrlFilter[] | null;
}) => {
  let allowedRedirectUrlFilters = getPortalAllowedRedirectUrlFilters(
    d.allowedRedirectUrlFilters
  );

  for (let redirectUri of d.redirectUris) {
    validateUrlString(redirectUri, 'redirect_uri');

    if (
      !allowedRedirectUrlFilters.some(filter =>
        portalAllowedRedirectUrlFilterMatches(filter, redirectUri)
      )
    ) {
      throw new ServiceError(
        badRequestError({
          message: 'redirect_uri is not allowed for this portal',
          oauth: {
            error: 'invalid_request',
            errorMessage: 'redirect_uri is not allowed for this portal'
          }
        })
      );
    }
  }
};

export let validateRedirectUri = (redirectUri: string, allowedRedirectUris: string[]) => {
  validateUrlString(redirectUri, 'redirect_uri');

  if (!allowedRedirectUris.some(allowedUri => urlsMatch(allowedUri, redirectUri))) {
    throw new ServiceError(
      badRequestError({
        message: 'Invalid redirect URI',
        oauth: {
          error: 'invalid_request',
          errorMessage: 'Invalid redirect URI'
        }
      })
    );
  }
};

export let base64UrlEncode = (input: Uint8Array) =>
  Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

export let createCodeChallenge = async (codeVerifier: string) => {
  let digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier));
  return base64UrlEncode(new Uint8Array(digest));
};
