import { isPublicIp } from '@lowerdeck/ssrf';
import ipaddr from 'ipaddr.js';
import { lookup } from 'node:dns/promises';

export class WebSocketUrlNotAllowedError extends Error {
  readonly code = 'gateway_url_not_allowed';
}

// Known limit: the socket resolves the host again, so DNS rebinding after this check is not blocked.
export let assertPublicWebSocketUrl = async (rawUrl: string) => {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new WebSocketUrlNotAllowedError('The gateway URL is not a valid URL.');
  }

  if (url.protocol !== 'wss:') {
    throw new WebSocketUrlNotAllowedError('The gateway URL must use wss://.');
  }
  if (url.username || url.password) {
    throw new WebSocketUrlNotAllowedError('The gateway URL must not contain credentials.');
  }

  let host = url.hostname.replace(/^\[|\]$/g, '');
  if (!host) throw new WebSocketUrlNotAllowedError('The gateway URL must include a host.');

  let addresses = ipaddr.isValid(host)
    ? [host]
    : (await lookup(host, { all: true, verbatim: true })).map(record => record.address);

  if (addresses.length === 0 || !addresses.every(address => isPublicIp(address))) {
    throw new WebSocketUrlNotAllowedError(
      `The gateway host ${host} resolves to a private or internal address.`
    );
  }

  return url;
};
