import { getAxiosSsrfFilter } from '../http/axiosSsrf';
import { axiosWithoutSse } from '../http/sse';
import type { OAuthConfiguration } from './types';

export class OAuthDiscovery {
  private static readonly WELL_KNOWN_PATHS = [
    '/.well-known/openid-configuration',
    '/.well-known/oauth-protected-resource',
    '/.well-known/oauth-authorization-server',
    '/oauth/metadata.json'
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

  static async checkIfManualAuthIsNeeded(url: string) {
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

      return response.status === 401;
    } catch (error) {
      return false;
    }
  }

  private static async fetchDiscoveryDocument(
    url: string
  ): Promise<OAuthConfiguration | null> {
    let config = await this.fetchJsonDocument(url);
    if (!config) return null;

    if (this.isValidOAuthConfig(config)) {
      return config;
    }

    let authServers = this.getProtectedResourceAuthorizationServers(config);
    if (!authServers || authServers.length === 0) return null;

    for (let serverUrl of authServers) {
      try {
        let serverConfig = await this.fetchAuthorizationServerConfig(serverUrl);
        if (serverConfig) return serverConfig;
      } catch (error) {
        console.debug(`Failed to discover authorization server ${serverUrl}:`, error);
      }
    }

    return null;
  }

  private static async fetchJsonDocument(url: string): Promise<any | null> {
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

      return response.data;
    } catch (error) {
      return null;
    }
  }

  private static async fetchAuthorizationServerConfig(
    authorizationServerUrl: string
  ): Promise<OAuthConfiguration | null> {
    let discoveryUrls = this.getAuthorizationServerDiscoveryUrls(authorizationServerUrl);

    for (let discoveryUrl of discoveryUrls) {
      let config = await this.fetchJsonDocument(discoveryUrl);
      if (this.isValidOAuthConfig(config)) return config;
    }

    return null;
  }

  private static getAuthorizationServerDiscoveryUrls(authorizationServerUrl: string) {
    let url: URL;

    try {
      url = new URL(authorizationServerUrl);
    } catch (error) {
      return [];
    }

    if (url.protocol !== 'https:') return [];

    if (url.pathname.includes('/.well-known/')) {
      return [url.toString()];
    }

    let baseUrl = `${url.protocol}//${url.host}`;
    let pathname = url.pathname === '/' ? '' : url.pathname.replace(/\/$/, '');

    return Array.from(
      new Set([
        `${baseUrl}/.well-known/oauth-authorization-server${pathname}`,
        `${baseUrl}/.well-known/openid-configuration${pathname}`,
        `${baseUrl}${pathname}/.well-known/oauth-authorization-server`,
        `${baseUrl}${pathname}/.well-known/openid-configuration`,
        url.toString()
      ])
    );
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
          let config = await this.fetchAuthorizationServerConfig(serverUrl);
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

      if (process.env.NODE_ENV !== 'production') {
        if (error.name === 'AbortError') {
          console.debug('WWW-Authenticate discovery timed out');
        } else {
          console.debug('Error during WWW-Authenticate discovery:', error);
        }
      }

      return null;
    }
  }

  private static parseAuthorizationServers(wwwAuth: string): string[] | null {
    let match = wwwAuth.match(/authorization_servers\s*=\s*"([^"]+)"/);
    if (!match) return null;

    try {
      let serversJson = match[1]!.replace(/\\"/g, '"');
      let servers = JSON.parse(serversJson);
      if (Array.isArray(servers)) {
        return servers.filter(url => typeof url === 'string');
      }
    } catch (error) {
      console.debug('Error parsing authorization_servers:', error);
    }

    return null;
  }

  private static getProtectedResourceAuthorizationServers(config: any): string[] | null {
    if (
      !config ||
      typeof config !== 'object' ||
      !Array.isArray(config.authorization_servers)
    ) {
      return null;
    }

    let servers = config.authorization_servers.filter(
      (server: unknown) => typeof server === 'string'
    );

    return servers.length > 0 ? servers : null;
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
