import { UnifiedApiKey } from '@metorial/api-keys';
import { getConfig } from '@metorial/config';
import { addHours, addSeconds } from 'date-fns';
import { env } from '../env';

export let INTERACTIVE_REQUEST_TTL_MINUTES = 60 * 12;
export let DEVICE_REQUEST_TTL_MINUTES = 15;
export let ACCESS_TOKEN_TTL_HOURS = 1;
export let ACCESS_TOKEN_MIN_TTL_SECONDS = 60;
export let ACCESS_TOKEN_MAX_TTL_SECONDS = 90 * 24 * 60 * 60;

export let createIssuedOAuthTokenValues = (d: {
  withRefreshToken: boolean;
  accessTokenLifetimeSeconds?: number;
  refreshTokenLifetimeDays?: number;
}) => {
  let now = new Date();
  let config = {
    url: getConfig().urls.apiUrl,
    instance: `v2-${env.service.METORIAL_REGION ?? 'ext'}`
  } as const;

  return {
    accessToken: UnifiedApiKey.create({
      type: 'oauth_access_token',
      config
    }).toString(),

    refreshToken: d.withRefreshToken
      ? UnifiedApiKey.create({
          type: 'oauth_refresh_token',
          config
        }).toString()
      : null,

    accessTokenExpiresAt: d.accessTokenLifetimeSeconds
      ? addSeconds(now, d.accessTokenLifetimeSeconds)
      : addHours(now, ACCESS_TOKEN_TTL_HOURS),

    completelyExpiresAt: null
  };
};
