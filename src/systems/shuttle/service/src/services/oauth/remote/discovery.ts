import { badRequestError, ServiceError } from '@mtsrc/error';
import { Service } from '@mtsrc/service';
import { db } from '../../../db';
import { getId } from '../../../id';
import { OAuthDiscovery } from '../../../lib/oauth/discovery';
import { OAuthUtils } from '../../../lib/oauth/oauthUtils';
import { oauthConfigValidator, type OAuthConfiguration } from '../../../lib/oauth/types';

class remoteOAuthDiscoveryServiceImpl {
  async discoverOauthConfigWithoutRegistration(d: { discoveryUrl: string }) {
    let existingDoc = await db.remoteOAuthDiscoveryDocument.findUnique({
      where: { discoveryUrl: d.discoveryUrl }
    });
    if (existingDoc) return existingDoc;

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

    return await db.remoteOAuthDiscoveryDocument.upsert({
      where: { discoveryUrl: d.discoveryUrl },
      update: {},
      create: {
        ...getId('remoteOAuthDiscoveryDocument'),

        config: doc as any,
        configHash,
        refreshedAt: new Date(),

        version: 1,

        providerName: OAuthUtils.getProviderName(doc),
        providerUrl: OAuthUtils.getProviderUrl(doc),
        discoveryUrl: d.discoveryUrl
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
