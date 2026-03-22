import { UnifiedApiKey } from '@metorial/api-keys';
import { getConfig } from '@metorial/config';
import { addDays, addHours } from 'date-fns';
import { env } from '../env';

export let INTERACTIVE_REQUEST_TTL_MINUTES = 60 * 12;
export let DEVICE_REQUEST_TTL_MINUTES = 15;
export let ACCESS_TOKEN_TTL_HOURS = 1;
export let REFRESH_TOKEN_TTL_DAYS = 30;

export let createIssuedOAuthTokenValues = (d: {
  withRefreshToken: boolean;
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

    accessTokenExpiresAt: addHours(now, ACCESS_TOKEN_TTL_HOURS),

    completelyExpiresAt: d.withRefreshToken
      ? addDays(now, d.refreshTokenLifetimeDays ?? REFRESH_TOKEN_TTL_DAYS)
      : null
  };
};
