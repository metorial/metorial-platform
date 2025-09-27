import { axiosWithoutSse } from '@metorial/axios-sse';
import { getAxiosSsrfFilter } from '@metorial/ssrf';
import { OAuthConfiguration } from '../types';

export class OAuthDiscovery {
  private static readonly WELL_KNOWN_PATHS = [
    '/.well-known/openid-configuration',
    '/.well-known/oauth-authorization-server',
    '/.well-known/oauth-protected-resource'
  ];

  private static readonly WWW_AUTHENTICATE_TIMEOUT = 5000; // 5 seconds

  static async discover(providerUrl: string): Promise<OAuthConfiguration | null> {
    let url = new URL(providerUrl);
    if (url.protocol !== 'https:') {
      return null; // Only support HTTPS for security reasons
    }

    let baseUrl = `${url.protocol}//${url.host}`;

    try {
      let config = await this.fetchDiscoveryDocument(providerUrl);
      if (config) return config;
    } catch (error) {}

    for (let path of this.WELL_KNOWN_PATHS) {
      try {
        let discoveryUrl = `${baseUrl}${url.pathname}${path}`;
        let config = await this.fetchDiscoveryDocument(discoveryUrl);
        if (config) return config;
      } catch (error) {}
    }

    for (let path of this.WELL_KNOWN_PATHS) {
      try {
        let discoveryUrl = `${baseUrl}${path}`;
        let config = await this.fetchDiscoveryDocument(discoveryUrl);
        if (config) return config;
      } catch (error) {}
    }

    try {
      let config = await this.wwwAuthenticateDiscovery(baseUrl);
      if (config) return config;
    } catch (error) {}

    return null;
  }

  private static async fetchDiscoveryDocument(
    url: string
  ): Promise<OAuthConfiguration | null> {
    try {
      let response = await axiosWithoutSse(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Metorial (https://metorial.com)'
        },
        validateStatus: status => status >= 200 && status < 500, // allow 4xx to fall through
        maxRedirects: 5,
        timeout: 2000,
        ...getAxiosSsrfFilter(url)
      });

      if (response.status >= 400) {
        return null;
      }

      let config = response.data;
      if (this.isValidOAuthConfig(config)) {
        return config;
      }

      return null;
    } catch (error) {
      console.debug(`Error fetching discovery document from ${url}:`, error);
      return null;
    }
  }

  private static async wwwAuthenticateDiscovery(
    baseUrl: string
  ): Promise<OAuthConfiguration | null> {
    let controller = new AbortController();
    let timeoutId = setTimeout(() => controller.abort(), this.WWW_AUTHENTICATE_TIMEOUT);

    try {
      let response = await axiosWithoutSse(baseUrl, {
        method: 'GET',
        headers: {
          Accept: 'application/json,text/event-stream',
          'User-Agent': 'Metorial (https://metorial.com)'
        },
        signal: controller.signal,
        validateStatus: () => true, // allow all statuses to be processed
        maxRedirects: 5,
        timeout: 2000,
        ...getAxiosSsrfFilter(baseUrl)
      });

      clearTimeout(timeoutId);

      if (response.status !== 401) {
        return null;
      }

      let wwwAuth = response.headers['www-authenticate'];
      if (!wwwAuth) {
        return null;
      }

      let authServers = this.parseAuthorizationServers(wwwAuth);
      if (!authServers || authServers.length === 0) {
        return null;
      }

      for (let serverUrl of authServers) {
        try {
          let config = await this.fetchDiscoveryDocument(serverUrl);
          if (config) {
            return config;
          }
        } catch (error) {
          console.debug(`Failed to fetch from authorization server ${serverUrl}:`, error);
        }
      }

      return null;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        console.debug('WWW-Authenticate discovery timed out');
      } else {
        console.debug('Error during WWW-Authenticate discovery:', error);
      }
      return null;
    }
  }

  private static parseAuthorizationServers(wwwAuth: string): string[] | null {
    let match = wwwAuth.match(/authorization_servers\s*=\s*"([^"]+)"/);
    if (!match) return null;

    try {
      let serversJson = match[1].replace(/\\"/g, '"');
      let servers = JSON.parse(serversJson);
      if (Array.isArray(servers)) {
        return servers.filter(url => typeof url === 'string');
      }
    } catch (error) {
      console.debug('Error parsing authorization_servers:', error);
    }

    return null;
  }

  private static isValidOAuthConfig(config: any): boolean {
    return (
      config &&
      typeof config === 'object' &&
      typeof config.authorization_endpoint === 'string' &&
      typeof config.token_endpoint === 'string' &&
      (config.issuer === undefined || typeof config.issuer === 'string')
    );
  }
}
