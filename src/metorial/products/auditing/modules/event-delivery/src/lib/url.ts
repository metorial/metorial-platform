import { badRequestError, ServiceError } from '@lowerdeck/error';
import { isPublicIp } from '@lowerdeck/ssrf';
import { isIP } from 'net';

export class DeliveryUrlNotAllowedError extends Error {}

let loopbackHostnames = [
  'localhost',
  'localhost.localdomain',
  'ip6-localhost',
  'ip6-loopback'
];

let isLoopbackHostname = (hostname: string) => {
  let name = hostname.replace(/\.$/, '');

  return loopbackHostnames.includes(name) || name.endsWith('.localhost');
};

export let assertDeliveryUrlAllowed = (url: string) => {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new DeliveryUrlNotAllowedError('Delivery URL is not a valid URL');
  }

  if (parsed.protocol != 'http:' && parsed.protocol != 'https:') {
    throw new DeliveryUrlNotAllowedError('Delivery URL must use http or https');
  }

  if (parsed.username || parsed.password) {
    throw new DeliveryUrlNotAllowedError('Delivery URL must not contain credentials');
  }

  let hostname = parsed.hostname.replace(/^\[|\]$/g, '');
  if (isIP(hostname) && !isPublicIp(hostname)) {
    throw new DeliveryUrlNotAllowedError('Delivery URL must not point at a private address');
  }

  if (isLoopbackHostname(hostname)) {
    throw new DeliveryUrlNotAllowedError('Delivery URL must not point at localhost');
  }

  return parsed;
};

export let assertDeliveryUrlAllowedForInput = (url: string) => {
  try {
    assertDeliveryUrlAllowed(url);
  } catch (error) {
    throw new ServiceError(
      badRequestError({
        message:
          error instanceof DeliveryUrlNotAllowedError
            ? error.message
            : 'Delivery URL is invalid',
        description:
          'Event destinations must point at a publicly reachable http(s) URL. Private, loopback, link-local and internal addresses are rejected.'
      })
    );
  }
};
