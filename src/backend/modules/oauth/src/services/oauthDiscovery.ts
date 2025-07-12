import { db, ID } from '@metorial/db';
import { badRequestError, ServiceError } from '@metorial/error';
import { Service } from '@metorial/service';
import { OAuthDiscovery } from '../lib/discovery';
import { OAuthUtils } from '../lib/oauthUtils';
import { oauthConfigValidator } from '../types';

class OauthDiscoveryServiceImpl {
  async discoverOauthConfig(d: { discoveryUrl: string }) {
    let existingDoc = await db.providerOAuthDiscoveryDocument.findUnique({
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

    let configHash = await OAuthUtils.getConfigHash(doc);

    return await db.providerOAuthDiscoveryDocument.upsert({
      where: { discoveryUrl: d.discoveryUrl },
      update: {},
      create: {
        id: await ID.generateId('oauthDiscoveryDocument'),

        config: doc,
        configHash,
        refreshedAt: new Date(),

        version: 1,

        providerName: OAuthUtils.getProviderName(doc),
        providerUrl: OAuthUtils.getProviderUrl(doc),
        discoveryUrl: d.discoveryUrl
      }
    });
  }
}

export let oauthDiscoveryService = Service.create(
  'oauthDiscovery',
  () => new OauthDiscoveryServiceImpl()
).build();
