import { fetchBearerToken, fetchDigest, parseBearerChallenge } from './connection';
import { withRetry } from './retry';

export interface ResolveImageParams {
  registry: string;
  repository: string;
  tag: string;
  username?: string;
  password?: string;
}

export let resolveImageDigest = async (params: ResolveImageParams) => {
  return await withRetry(async () => {
    let manifestUrl = `https://${params.registry}/v2/${params.repository}/manifests/${params.tag}`;

    let baseHeaders: Record<string, string> = {
      Accept: 'application/vnd.docker.distribution.manifest.v2+json'
    };

    if (params.username && params.password) {
      let basic = Buffer.from(`${params.username}:${params.password}`).toString('base64');
      baseHeaders['Authorization'] = `Basic ${basic}`;
    }

    try {
      return await fetchDigest(manifestUrl, baseHeaders);
    } catch (err: any) {
      if (!err.response) {
        throw err;
      }

      if (err.response.status !== 401) {
        throw new Error(`Failed to fetch digest: ${err.message}`);
      }

      let challenge = err.response.headers['www-authenticate'];
      if (!challenge) {
        throw new Error('Unauthorized and no WWW-Authenticate header present');
      }

      let bearer = parseBearerChallenge(challenge);
      if (!bearer) {
        throw new Error(`Unsupported auth challenge: ${challenge}`);
      }

      let token = await fetchBearerToken(bearer, params);
      let headersWithToken = {
        ...baseHeaders,
        Authorization: `Bearer ${token}`
      };

      return await fetchDigest(manifestUrl, headersWithToken);
    }
  });
};
