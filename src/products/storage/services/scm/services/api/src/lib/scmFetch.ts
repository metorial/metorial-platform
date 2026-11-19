import { badRequestError, ServiceError } from '@lowerdeck/error';
import { assertUrlIpAllowed, isPublicIp, safeFetch, SsrfBlockedError } from '@lowerdeck/ssrf';
import { isIP } from 'node:net';
import { ScmPolicyError, scmAllowsPrivateNetworks } from './scmPolicy';

let toPolicyError = (error: unknown) =>
  error instanceof SsrfBlockedError
    ? new ScmPolicyError('The source control provider address is not reachable from Metorial.')
    : error;

export let scmFetch = async (input: string | URL, init: RequestInit = {}) => {
  try {
    return await safeFetch(input.toString(), {
      ...init,
      isIpAllowed: scmAllowsPrivateNetworks ? false : isPublicIp
    });
  } catch (error) {
    throw toPolicyError(error);
  }
};

export let assertScmUrlsReachable = async (...urls: string[]) => {
  if (scmAllowsPrivateNetworks) return;

  try {
    for (let url of urls) await assertUrlIpAllowed(url);
  } catch (error) {
    throw toPolicyError(error);
  }
};

export let assertScmBackendUrlsValid = (...urls: string[]) => {
  for (let value of urls) {
    let url = new URL(value);
    let hostname = url.hostname
      .replace(/^\[|\]$/g, '')
      .toLowerCase()
      .replace(/\.$/, '');

    let isInvalid =
      !['http:', 'https:'].includes(url.protocol) ||
      !!url.username ||
      !!url.password ||
      (!scmAllowsPrivateNetworks &&
        (hostname === 'localhost' ||
          hostname.endsWith('.localhost') ||
          (isIP(hostname) !== 0 && !isPublicIp(hostname))));

    if (isInvalid) {
      throw new ServiceError(
        badRequestError({
          message: 'Enter a publicly reachable HTTP or HTTPS provider URL without credentials.'
        })
      );
    }
  }
};
