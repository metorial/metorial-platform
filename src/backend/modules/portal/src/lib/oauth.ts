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

let blockedPortalRedirectProtocols = new Set([
  'about',
  'blob',
  'chrome',
  'chrome-extension',
  'data',
  'file',
  'ftp',
  'ftps',
  'gopher',
  'http+unix',
  'imap',
  'irc',
  'ircs',
  'ldap',
  'ldaps',
  'mailto',
  'news',
  'nntp',
  'sftp',
  'sms',
  'ssh',
  'tel',
  'telnet',
  'urn',
  'ws',
  'wss'
]);

let validatePortalRedirectProtocol = (protocol: string, field: string) => {
  if (!blockedPortalRedirectProtocols.has(protocol)) return;

  throw new ServiceError(
    badRequestError({
      message: `${field} uses a blocked redirect protocol`,
      oauth: {
        error: 'invalid_request',
        errorMessage: `${field} uses a blocked redirect protocol`
      }
    })
  );
};

let normalizeLoopbackHostname = (hostname: string) => {
  let normalizedHostname = hostname.toLowerCase();
  let unwrappedHostname = normalizedHostname.replace(/^\[(.*)\]$/, '$1');

  if (unwrappedHostname == 'localhost' || unwrappedHostname == '::1') {
    return 'localhost';
  }

  let ipv4Parts = unwrappedHostname.split('.');
  if (
    ipv4Parts.length == 4 &&
    ipv4Parts.every(part => /^\d+$/.test(part) && Number(part) >= 0 && Number(part) <= 255) &&
    Number(ipv4Parts[0]) == 127
  ) {
    return 'localhost';
  }

  return normalizedHostname;
};

let normalizeUrlForComparison = (url: URL) => {
  return {
    protocol: url.protocol.replace(/:$/, '').toLowerCase(),
    hostname: normalizeLoopbackHostname(url.hostname),
    port: url.port,
    pathname: url.pathname
  };
};

export let urlsMatch = (url1: string, url2: string) => {
  try {
    let u1 = normalizeUrlForComparison(new URL(url1));
    let u2 = normalizeUrlForComparison(new URL(url2));

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

  if (match.groups.protocol != '*') {
    validatePortalRedirectProtocol(match.groups.protocol.toLowerCase(), field);
  }

  return {
    protocol: match.groups.protocol.toLowerCase(),
    hostname: normalizeLoopbackHostname(hostname),
    port,
    path: match.groups.path
  };
};

let matchesPortalAllowedRedirectUrlFilterProtocol = (
  protocolPattern: string,
  protocol: string
) => {
  if (protocolPattern == '*') {
    return protocol != 'http' && protocol != 'https' && !blockedPortalRedirectProtocols.has(protocol);
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
    let url = new URL(value);
    validatePortalRedirectProtocol(url.protocol.replace(/:$/, '').toLowerCase(), field);
  } catch (error) {
    if (error instanceof ServiceError) throw error;

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

export let portalAllowedRedirectUrlFiltersEqual = (
  filters1: PortalAllowedRedirectUrlFilter[],
  filters2: PortalAllowedRedirectUrlFilter[]
) => {
  if (filters1.length != filters2.length) return false;

  let normalizeFilter = (filter: PortalAllowedRedirectUrlFilter) => {
    let parsedFilter = parsePortalAllowedRedirectUrlFilter(
      filter.url,
      'allowed_redirect_url_filters.url'
    );

    return `${parsedFilter.protocol}://${parsedFilter.hostname}${
      parsedFilter.port ? `:${parsedFilter.port}` : ''
    }${parsedFilter.path ?? ''}`;
  };

  let normalizedFilters1 = new Set(filters1.map(normalizeFilter));
  let normalizedFilters2 = new Set(filters2.map(normalizeFilter));
  if (normalizedFilters1.size != normalizedFilters2.size) return false;

  return [...normalizedFilters1].every(filter => normalizedFilters2.has(filter));
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
  let redirectUrl = normalizeUrlForComparison(new URL(redirectUri));

  return (
    matchesPortalAllowedRedirectUrlFilterProtocol(
      parsedFilter.protocol,
      redirectUrl.protocol
    ) &&
    matchesPortalAllowedRedirectUrlFilterHostname(
      parsedFilter.hostname,
      redirectUrl.hostname
    ) &&
    matchesPortalAllowedRedirectUrlFilterPort(parsedFilter.port, redirectUrl.port) &&
    matchesPortalAllowedRedirectUrlFilterPath(parsedFilter.path, redirectUrl.pathname)
  );
};

export let portalRedirectUriMatchesAllowedFilters = (d: {
  redirectUri: string;
  allowedRedirectUrlFilters?: PortalAllowedRedirectUrlFilter[] | null;
}) => {
  validateUrlString(d.redirectUri, 'redirect_uri');

  let allowedRedirectUrlFilters = getPortalAllowedRedirectUrlFilters(
    d.allowedRedirectUrlFilters
  );
  return allowedRedirectUrlFilters.some(filter =>
    portalAllowedRedirectUrlFilterMatches(filter, d.redirectUri)
  );
};

export let validatePortalRedirectUriAgainstAllowedFilters = (d: {
  redirectUri: string;
  allowedRedirectUrlFilters?: PortalAllowedRedirectUrlFilter[] | null;
}) => {
  if (
    !portalRedirectUriMatchesAllowedFilters({
      redirectUri: d.redirectUri,
      allowedRedirectUrlFilters: d.allowedRedirectUrlFilters
    })
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
};

export let validatePortalRedirectUrisAgainstAllowedFilters = (d: {
  redirectUris: string[];
  allowedRedirectUrlFilters?: PortalAllowedRedirectUrlFilter[] | null;
}) => {
  for (let redirectUri of d.redirectUris) {
    validateUrlString(redirectUri, 'redirect_uri');
  }

  if (
    !d.redirectUris.some(redirectUri =>
      portalRedirectUriMatchesAllowedFilters({
        redirectUri,
        allowedRedirectUrlFilters: d.allowedRedirectUrlFilters
      })
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
