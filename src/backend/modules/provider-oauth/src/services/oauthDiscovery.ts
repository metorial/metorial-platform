import { db, ID } from '@metorial/db';
import { badRequestError, ServiceError } from '@metorial/error';
import { Service } from '@metorial/service';
import { OAuthDiscovery } from '../lib/discovery';
import { OAuthUtils } from '../lib/oauthUtils';
import { OAuthConfiguration, oauthConfigValidator } from '../types';

class OauthDiscoveryServiceImpl {
  async discoverOauthConfigWithoutRegistration(d: { discoveryUrl: string }) {
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

  async discoverOauthConfig(d: {
    discoveryUrl: string;
    input: {
      clientName: string;
    };
  }) {
    let discovery = await this.discoverOauthConfigWithoutRegistration(d);

    let config = discovery.config as OAuthConfiguration;
    if (!config.registration_endpoint) {
      return {
        discovery,
        autoRegistration: null
      };
    }

    let clientName = `${d.input.clientName} (via Metorial)`;

    let registration = await OAuthUtils.registerClient({ clientName }, config);
    if (!registration) {
      return {
        discovery,
        autoRegistration: null
      };
    }

    let autoRegistration = await db.providerOAuthAutoRegistration.create({
      data: {
        id: await ID.generateId('oauthAutoRegistration'),
        generatedClientName: clientName,
        clientId: registration.client_id,
        clientSecret: registration.client_secret,
        clientSecretExpiresAt: registration.client_secret_expires_at,
        registrationAccessToken: registration.registration_access_token,
        registrationClientUri: registration.registration_client_uri,
        discoveryDocumentOid: discovery.oid
      }
    });

    return {
      discovery,
      autoRegistration
    };
  }
}

export let providerOauthDiscoveryService = Service.create(
  'providerOauthDiscovery',
  () => new OauthDiscoveryServiceImpl()
).build();
