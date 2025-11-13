import { generatePlainId } from '@metorial/id';
import { Service } from '@metorial/service';
import { Connection, Tenant } from '../db/schema';
import { jackson } from '../lib/jackson';

class connectionServiceImpl {
  async createSamlConnection(d: {
    tenant: Tenant;
    input: {
      name: string;
      metadata: Record<string, any>;

      provider: string;

      samlMetadata:
        | {
            type: 'xml';
            payload: string;
          }
        | {
            type: 'url';
            url: string;
          };
    };
  }) {
    let con = await jackson.apiController.createSAMLConnection({
      product: 'metorial',
      tenant: d.tenant._id,
      name: d.input.name,

      redirectUrl: jackson.redirectUrl,
      defaultRedirectUrl: jackson.defaultRedirectUrl.saml,

      rawMetadata:
        d.input.samlMetadata.type === 'xml' ? d.input.samlMetadata.payload : undefined!,
      metadataUrl: d.input.samlMetadata.type === 'url' ? d.input.samlMetadata.url : undefined
    });

    return await Connection.create({
      tenantId: d.tenant._id,

      internalClientId: con.clientID,
      internalClientSecret: con.clientSecret,

      providerType: 'saml',
      providerName: d.input.provider,

      name: d.input.name,
      metadata: d.input.metadata
    });
  }

  async createOidcConnection(d: {
    tenant: Tenant;
    input: {
      name: string;
      metadata: Record<string, any>;

      provider: string;

      oidcDiscoveryUrl: string;
      clientId: string;
      clientSecret: string;
    };
  }) {
    let internalId = generatePlainId(20);

    let con = await jackson.apiController.createOIDCConnection({
      product: 'metorial',
      tenant: internalId,
      name: d.input.name,

      oidcMetadata: undefined,
      oidcDiscoveryUrl: d.input.oidcDiscoveryUrl,
      oidcClientId: d.input.clientId,
      oidcClientSecret: d.input.clientSecret,

      redirectUrl: jackson.redirectUrl,
      defaultRedirectUrl: jackson.defaultRedirectUrl.oidc
    });

    return await Connection.create({
      tenantId: d.tenant._id,

      internalId,
      internalClientId: con.clientID,
      internalClientSecret: con.clientSecret,

      providerType: 'oidc',
      providerName: d.input.provider,

      name: d.input.name,
      metadata: d.input.metadata
    });
  }

  async getConnectionsByTenant(d: { tenant: Tenant }) {
    return await Connection.find({ tenantId: d.tenant._id });
  }

  async getConnectionById(d: { connectionId: string; tenant: Tenant }) {
    return await Connection.findOne({ _id: d.connectionId, tenantId: d.tenant._id });
  }
}

export let connectionService = Service.create(
  'connection',
  () => new connectionServiceImpl()
).build();
