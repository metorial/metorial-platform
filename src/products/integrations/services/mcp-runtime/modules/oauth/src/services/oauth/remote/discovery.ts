import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { db } from '@mtsrc/mcp-runtime-db';
import { getId } from '@mtsrc/mcp-runtime-db';
import { OAuthDiscovery } from '@mtsrc/mcp-runtime-oauth-utils';
import { OAuthUtils } from '@mtsrc/mcp-runtime-oauth-utils';
import { oauthConfigValidator, type OAuthConfiguration } from '@mtsrc/mcp-runtime-oauth-utils';

class remoteOAuthDiscoveryServiceImpl {
  async discoverOauthConfigWithoutRegistration(d: { discoveryUrl: string }) {
    let doc = await OAuthDiscovery.discover(d.discoveryUrl);
    if (!doc) {
      throw new ServiceError(
        badRequestError({
          message: `No OAuth configuration found for ${d.discoveryUrl}`
        })
      );
    }

    let valRes = oauthConfigValidator.validate(doc);
    if (!valRes.success) {
      throw new ServiceError(
        badRequestError({
          message: `Invalid OAuth configuration from ${d.discoveryUrl}`,
          details: valRes.errors
        })
      );
    }

    let configHash = await OAuthUtils.getConfigHash(doc, []);

    let inner = {
      config: doc as any,
      configHash,
      refreshedAt: new Date(),

      version: 1,

      providerName: OAuthUtils.getProviderName(doc),
      providerUrl: OAuthUtils.getProviderUrl(doc),
      discoveryUrl: d.discoveryUrl
    };

    return await db.remoteOAuthDiscoveryDocument.upsert({
      where: { discoveryUrl: d.discoveryUrl },
      update: inner,
      create: {
        ...getId('remoteOAuthDiscoveryDocument'),
        ...inner
      }
    });
  }

  async discoverOauthConfigWithoutRegistrationSafe(d: { discoveryUrl: string }) {
    try {
      return await this.discoverOauthConfigWithoutRegistration(d);
    } catch (e) {
      return null;
    }
  }

  async supportsAutoRegistration(d: { config: OAuthConfiguration }) {
    return OAuthUtils.supportsAuthRegistration(d.config);
  }
}

export let remoteOAuthDiscoveryService = Service.create(
  'remoteOAuthDiscovery',
  () => new remoteOAuthDiscoveryServiceImpl()
).build();
