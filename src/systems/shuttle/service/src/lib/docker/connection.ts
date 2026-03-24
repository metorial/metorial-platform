import axios, { type AxiosRequestConfig } from 'axios';
import { getAxiosSsrfFilter } from '../http/axiosSsrf';

let REQUEST_TIMEOUT_MS = 10_000;

export let fetchDigest = async (url: string, headers: Record<string, string>) => {
  let response = await axios.head(url, {
    ...getAxiosSsrfFilter(url),
    headers,
    timeout: REQUEST_TIMEOUT_MS,
    validateStatus: status => status >= 200 && status < 400
  });

  let digest = response.headers['docker-content-digest'];
  if (!digest) {
    throw new Error('Digest not found in response headers');
  }

  return digest;
};

export let parseBearerChallenge = (header: string) => {
  if (!header.toLowerCase().startsWith('bearer ')) {
    return null;
  }

  let params: Record<string, string> = {};
  let parts = header.slice(7).split(',');

  for (let part of parts) {
    let [key, value] = part.trim().split('=');
    if (!key || !value) continue;
    params[key] = value.replace(/^"|"$/g, '');
  }

  if (!params.realm) {
    return null;
  }

  return {
    realm: params.realm,
    service: params.service,
    scope: params.scope
  };
};

let TOKEN_CACHE_TTL_MS = 5 * 60 * 1000;

let tokenCache = new Map<string, { token: string; expiresAt: number }>();

let getTokenCacheKey = (
  challenge: { realm: string; service?: string; scope?: string },
  params: { username?: string; password?: string }
) => {
  return [challenge.realm, challenge.service ?? '', challenge.scope ?? '', params.username ?? '', params.password ?? ''].join('\0');
};

export let fetchBearerToken = async (
  challenge: { realm: string; service?: string; scope?: string },
  params: { username?: string; password?: string }
) => {
  let cacheKey = getTokenCacheKey(challenge, params);
  let cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.token;
  }

  let query: Record<string, string> = {};
  if (challenge.service) query.service = challenge.service;
  if (challenge.scope) query.scope = challenge.scope;

  let config: AxiosRequestConfig = {
    params: query
  };

  let hasCredentials = Boolean(params.username && params.password);
  let authConfig =
    hasCredentials && params.username && params.password
      ? {
          auth: {
            username: params.username,
            password: params.password
          }
        }
      : {};

  let token: string;
  let requestToken = async (withCredentials: boolean) => {
    let response = await axios.get(challenge.realm, {
      ...config,
      ...(withCredentials ? authConfig : {}),
      ...getAxiosSsrfFilter(challenge.realm),
      timeout: REQUEST_TIMEOUT_MS
    });

    return response.data.token || response.data.access_token;
  };

  try {
    token = await requestToken(hasCredentials);
  } catch (err: any) {
    let status = err.response?.status;
    if (hasCredentials && (status === 401 || status === 403)) {
      try {
        token = await requestToken(false);
      } catch (fallbackErr: any) {
        throw new Error(`Failed to fetch bearer token: ${getDockerErrorMessage(fallbackErr)}`);
      }
    } else {
      throw new Error(`Failed to fetch bearer token: ${getDockerErrorMessage(err)}`);
    }
  }

  if (!token) {
    throw new Error('Bearer token not found in auth response');
  }

  tokenCache.set(cacheKey, { token, expiresAt: Date.now() + TOKEN_CACHE_TTL_MS });

  return token;
};

export let getDockerErrorMessage = (err: any): string => {
  if (err.response && err.response.data) {
    let data = err.response.data;
    if (data.errors && Array.isArray(data.errors) && data.errors.length > 0) {
      return data.errors.map((e: any) => e.message).join('; ');
    }
    return JSON.stringify(data);
  }
  return err.message || 'Unknown error';
};
