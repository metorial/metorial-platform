import { badRequestError, ServiceError } from '@lowerdeck/error';
import { assertUrlIpAllowed, isPublicIp, safeFetch, SsrfBlockedError } from '@lowerdeck/ssrf';
import { ssoNetworkSettings } from '../env';

let METADATA_FETCH_TIMEOUT_MS = 8000;
let METADATA_MAX_BYTES = 1_000_000;

let loopbackHostnames = ['localhost', '127.0.0.1'];

export let ssoAllowsPrivateNetworks = ssoNetworkSettings.allowPrivateNetworks;

let identityProviderError = (message: string) =>
  new ServiceError(badRequestError({ message }));

let unreachableError = () =>
  identityProviderError('The identity provider address is not reachable from Metorial.');

let metadataFetchError = () =>
  identityProviderError('Could not fetch the identity provider metadata.');

let parseIdentityProviderUrl = (input: string) => {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw identityProviderError('Enter a valid identity provider URL.');
  }

  let isLoopbackHttp = url.protocol == 'http:' && loopbackHostnames.includes(url.hostname);
  if ((url.protocol != 'https:' && !isLoopbackHttp) || url.username || url.password) {
    throw identityProviderError('Enter an HTTPS identity provider URL without credentials.');
  }

  return url;
};

let readBoundedText = async (response: Response, maxBytes: number) => {
  let reader = response.body?.getReader();
  if (!reader) return '';

  let chunks: Uint8Array[] = [];
  let size = 0;

  while (true) {
    let { done, value } = await reader.read();
    if (done || !value) break;

    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel().catch(() => {});
      throw identityProviderError('The identity provider metadata is too large.');
    }

    chunks.push(value);
  }

  return Buffer.concat(chunks).toString('utf8');
};

export let assertSsoUrlReachable = async (input: string) => {
  let url = parseIdentityProviderUrl(input);
  if (ssoAllowsPrivateNetworks) return;

  try {
    await assertUrlIpAllowed(url.toString());
  } catch {
    throw unreachableError();
  }
};

export let fetchSsoMetadata = async (input: string) => {
  let url = parseIdentityProviderUrl(input);

  let response: Response;
  try {
    response = await safeFetch(url.toString(), {
      isIpAllowed: ssoAllowsPrivateNetworks ? false : isPublicIp,
      signal: AbortSignal.timeout(METADATA_FETCH_TIMEOUT_MS)
    });
  } catch (error) {
    throw error instanceof SsrfBlockedError ? unreachableError() : metadataFetchError();
  }

  if (!response.ok) {
    await response.body?.cancel().catch(() => {});
    throw metadataFetchError();
  }

  try {
    return await readBoundedText(response, METADATA_MAX_BYTES);
  } catch (error) {
    throw error instanceof ServiceError ? error : metadataFetchError();
  }
};
