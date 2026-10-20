import { isIP } from 'node:net';

let isPublicDomain = (hostname: string) => {
  let host = hostname.toLowerCase().replace(/\.$/, '');

  if (host == 'localhost' || host.endsWith('.localhost')) return false;
  if (isIP(host.replace(/^\[|\]$/g, ''))) return false;

  return host.includes('.');
};

let toDiscoveryUrl = (value: string, d: { originOnly: boolean }) => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (url.protocol != 'https:' && url.protocol != 'http:') return null;
  if (!isPublicDomain(url.hostname)) return null;

  return d.originOnly ? url.origin : url.toString();
};

export let getConsumerClientLogoDiscoveryUrl = (d: {
  clientUri: string | null;
  redirectUris: string[];
}) => {
  if (d.clientUri) {
    let clientUrl = toDiscoveryUrl(d.clientUri, { originOnly: false });
    if (clientUrl) return clientUrl;
  }

  for (let redirectUri of d.redirectUris) {
    let redirectUrl = toDiscoveryUrl(redirectUri, { originOnly: true });
    if (redirectUrl) return redirectUrl;
  }

  return null;
};
