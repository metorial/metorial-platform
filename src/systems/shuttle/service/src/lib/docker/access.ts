import { getSentry } from '@mtsrc/sentry';
import axios from 'axios';
import { getAxiosSsrfFilter } from '../http/axiosSsrf';
import { fetchBearerToken, parseBearerChallenge } from './connection';
import type { ParsedImageRef } from './parseImageRef';
import { withRetry } from './retry';

let Sentry = getSentry();

let REQUEST_TIMEOUT_MS = 10_000;

export interface ImageAccessResult {
  exists: boolean;
  accessible: boolean;
  reason?: string;
}

export let checkImageAccess = async ({
  ref: image,
  username,
  password
}: {
  ref: ParsedImageRef;
  username?: string;
  password?: string;
}): Promise<ImageAccessResult> => {
  try {
    return await withRetry(async () => {
      let reference = image.digest ?? image.tag ?? 'latest';
      let url = `https://${image.registry}/v2/${image.repository}/manifests/${reference}`;

      let baseHeaders: Record<string, string> = {
        Accept: 'application/vnd.docker.distribution.manifest.v2+json'
      };

      if (username && password) {
        let basic = Buffer.from(`${username}:${password}`).toString('base64');
        baseHeaders['Authorization'] = `Basic ${basic}`;
      }

      let response = await axios.head(url, {
        ...getAxiosSsrfFilter(url),
        headers: baseHeaders,
        timeout: REQUEST_TIMEOUT_MS,
        validateStatus: () => true
      });

      if (response.status === 200) {
        return { exists: true, accessible: true };
      }

      if (response.status === 404) {
        return {
          exists: false,
          accessible: false,
          reason: 'Image or reference not found'
        };
      }

      if (response.status !== 401) {
        return {
          exists: false,
          accessible: false,
          reason: `Unexpected status ${response.status}`
        };
      }

      let challenge = response.headers['www-authenticate'];
      if (!challenge) {
        return {
          exists: true,
          accessible: false,
          reason: 'Unauthorized without auth challenge'
        };
      }

      let bearer = parseBearerChallenge(challenge);
      if (!bearer) {
        return {
          exists: true,
          accessible: false,
          reason: 'Unsupported authentication scheme'
        };
      }

      let token = await fetchBearerToken(bearer, { username, password });
      let authHeaders = {
        ...baseHeaders,
        Authorization: `Bearer ${token}`
      };

      let retryResp = await axios.head(url, {
        ...getAxiosSsrfFilter(url),
        headers: authHeaders,
        timeout: REQUEST_TIMEOUT_MS,
        validateStatus: () => true
      });

      if (retryResp.status === 200) {
        return { exists: true, accessible: true };
      }

      if (retryResp.status === 404) {
        return {
          exists: false,
          accessible: false,
          reason: 'Image or reference not found'
        };
      }

      if (retryResp.status === 401 || retryResp.status === 403) {
        return {
          exists: true,
          accessible: false,
          reason: 'Access denied'
        };
      }

      return {
        exists: false,
        accessible: false,
        reason: `Unexpected status ${retryResp.status}`
      };
    });
  } catch (err: any) {
    let status = err.response?.status;
    if (status === 401 || status === 403) {
      return {
        exists: true,
        accessible: false,
        reason: 'Authentication failed'
      };
    }

    Sentry.captureException(err);

    return {
      exists: false,
      accessible: false,
      reason: `Connection error: ${err.message}`
    };
  }
};
