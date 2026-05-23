import { getSentry } from '@mtsrc/sentry';
import type {
  ServerAuthConfig,
  ServerConfig,
  ServerConnection,
  Tenant
} from '../../../prisma/generated/client';
import { serverAuthTokenService } from '../../services/oauth/serverAuthToken';
import type { ConnectionLogger } from '../utils/logger';

let Sentry = getSentry();

const EXPIRY_SAFETY_MARGIN_MS = 1000 * 30;

export class FunctionConnectionAuthManager {
  #accessTokenPromise: Promise<{
    accessToken: string;
    authConfigId: string;
    tokenId: string;
  }> | null = null;
  #expiresAt = Infinity;

  constructor(
    readonly logger: ConnectionLogger,
    readonly tenant: Tenant,
    readonly connection: ServerConnection & {
      serverConfig: ServerConfig;
      serverAuthConfig: ServerAuthConfig | null;
    }
  ) {}

  async getToken() {
    if (!this.connection.serverAuthConfig) {
      return null;
    }

    if (!this.#accessTokenPromise || Date.now() >= this.#expiresAt - EXPIRY_SAFETY_MARGIN_MS) {
      this.#accessTokenPromise = (async () => {
        this.logger.log('debug.info', 'Fetching new access token for function connection');

        try {
          let res = await serverAuthTokenService.useAuthToken({
            tenant: this.tenant,
            authConfig: this.connection.serverAuthConfig!
          });

          if (res.didRefresh) {
            this.logger.log('debug.info', 'Refreshed OAuth token for function connection');
          }

          this.logger.log('debug.info', 'Obtained new access token for function connection');
          if (res.expiresAt) {
            this.logger.log(
              'debug.info',
              `Access token expires at ${res.expiresAt.toLocaleString('en-US', { timeZone: 'UTC' })} UTC`
            );
          }

          this.#expiresAt = res.expiresAt?.getTime() ?? Infinity;

          return {
            accessToken: res.accessToken,
            authConfigId: res.authConfig.id,

            tokenId: `delegated/${res.delegatedToken?.id}`,

            expiresIn: res.expiresAt?.toISOString(),
            tokenType: res.delegatedToken?.tokenType
          };
        } catch (err) {
          Sentry.captureException(err, {
            extra: {
              connectionId: this.connection.id,
              tenantId: this.tenant.id
            }
          });

          this.logger.log(
            'debug.error',
            `Failed to obtain access token: ${(err as Error).message}`
          );

          throw err;
        }
      })();
    }

    return await this.#accessTokenPromise;
  }
}
