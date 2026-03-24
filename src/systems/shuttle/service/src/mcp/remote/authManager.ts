import { getSentry } from '@lowerdeck/sentry';
import type {
  ServerAuthConfig,
  ServerConfig,
  ServerConnection,
  Tenant
} from '../../../prisma/generated/client';
import { secretService } from '../../services';
import { serverAuthTokenService } from '../../services/oauth/serverAuthToken';
import type { ConnectionLogger } from '../utils/logger';

let Sentry = getSentry();

const EXPIRY_SAFETY_MARGIN_MS = 1000 * 30;

export class RemoteConnectionAuthManager {
  #accessTokenPromise: Promise<{
    accessToken: string;
    authConfigId: string;
    tokenId: string;
  }> | null = null;
  #expiresAt = Infinity;

  #configPromise: Promise<{
    headers: Record<string, string> | null | undefined;
    query: Record<string, string> | null | undefined;
  }> | null = null;

  constructor(
    readonly logger: ConnectionLogger,
    readonly tenant: Tenant,
    readonly connection: ServerConnection & {
      serverConfig: ServerConfig;
      serverAuthConfig: ServerAuthConfig | null;
    }
  ) {}

  private get serverConfig() {
    return this.connection.serverConfig;
  }

  async getHeaders() {
    let tokenRes = await this.getToken();
    let config = await this.getConfig();

    return {
      ...(config.headers ?? {}),

      'User-Agent': 'Metorial (https://metorial.com)',
      'Metorial-Connection-Id': `sse/con/${this.connection.id}`,
      ...(tokenRes
        ? {
            Authorization: `Bearer ${tokenRes.accessToken}`,
            'Metorial-Auth-Config-Id': tokenRes.authConfigId,
            'Metorial-Token-Id': tokenRes.tokenId,
            'Metorial-Token-Type': `remote.${this.connection.serverAuthConfig?.type}`
          }
        : {})
    };
  }

  async getQuery() {
    let config = await this.getConfig();
    return config.query ?? {};
  }

  async getConfig() {
    if (!this.#configPromise) {
      this.#configPromise = (async () => {
        let { transformed: config } = await secretService.DANGEROUSLY_decryptSecret({
          secretOid: this.serverConfig.secretOid,
          purpose: 'server_config_value',
          tenant: this.tenant
        });

        return config;
      })();
    }

    return await this.#configPromise;
  }

  async getToken() {
    if (!this.connection.serverAuthConfig) {
      return null;
    }

    if (!this.#accessTokenPromise || Date.now() >= this.#expiresAt - EXPIRY_SAFETY_MARGIN_MS) {
      this.#accessTokenPromise = (async () => {
        this.logger.log('debug.info', 'Fetching new access token for remote connection');

        try {
          let res = await serverAuthTokenService.useAuthToken({
            tenant: this.tenant,
            authConfig: this.connection.serverAuthConfig!
          });

          if (res.didRefresh) {
            this.logger.log('debug.info', 'Refreshed OAuth token for remote connection');
          }

          this.logger.log('debug.info', 'Obtained new access token for remote connection');
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
            tokenId: `remote/${res.remoteToken?.id}`
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
