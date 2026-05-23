import { badRequestError, ServiceError } from '@mtsrc/error';
import { Service } from '@mtsrc/service';
import type { ServerAuthConfig, Tenant } from '../../../prisma/generated/client';
import { delegatedAuthTokenService } from './delegated';
import { remoteAuthTokenService } from './remote';

class serverAuthTokenServiceImpl {
  async useAuthToken(d: { tenant: Tenant; authConfig: ServerAuthConfig }) {
    if (d.authConfig.type == 'remote' && d.authConfig.remoteOAuthConnectionAuthTokenOid) {
      let token = await remoteAuthTokenService.useAuthToken({
        tenant: d.tenant,
        remoteOAuthConnectionAuthTokenOid: d.authConfig.remoteOAuthConnectionAuthTokenOid,
        serverAuthConfig: d.authConfig
      });

      return {
        type: 'remote' as const,
        authConfig: d.authConfig,
        remoteToken: token.token,
        didRefresh: token.didRefresh,

        accessToken: token.accessToken,
        expiresAt: token.expiresAt
      };
    }

    if (
      d.authConfig.type == 'delegated' &&
      d.authConfig.delegatedOAuthConnectionAuthTokenOid
    ) {
      let token = await delegatedAuthTokenService.useAuthToken({
        tenant: d.tenant,
        delegatedOAuthConnectionAuthTokenOid: d.authConfig.delegatedOAuthConnectionAuthTokenOid,
        serverAuthConfig: d.authConfig
      });

      return {
        type: 'delegated' as const,
        authConfig: d.authConfig,
        delegatedToken: token.token,
        didRefresh: token.didRefresh,

        accessToken: token.accessToken,
        expiresAt: token.expiresAt
      };
    }

    throw new ServiceError(
      badRequestError({
        message: 'Provider does not support OAuth authentication'
      })
    );
  }
}

export let serverAuthTokenService = Service.create(
  'serverAuthTokenService',
  () => new serverAuthTokenServiceImpl()
).build();
