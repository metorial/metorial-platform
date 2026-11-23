import { db, type Organization } from '@mtsrc/ai-gateway-db';
import type { ProviderCredentials } from '@mtsrc/ai-gateway-spec';
import { createNebulaClient } from '@mtsrc/secret-store-client-internal';
import os from 'node:os';
import { env } from '../env';

let secretPurpose = 'ai_gateway_provider_credentials';

let nebulaClient: ReturnType<typeof createNebulaClient> | null = null;

let getNebulaClient = () => {
  nebulaClient ??= createNebulaClient({
    endpoint: env.nebula.NEBULA_API_URL,
    consumerToken: env.nebula.NEBULA_CONSUMER_TOKEN,
    identifier: os.hostname()
  });

  return nebulaClient;
};

export type SecretOwner = { organization: Organization };

let resolveTenant = async (owner: SecretOwner) => {
  let organization = owner.organization;
  if (!organization.nebulaTenantId) {
    let tenant = await getNebulaClient().tenant.upsert({
      name: organization.name ?? organization.ref,
      identifier: `ai-gateway:organization:${organization.id}`
    });

    organization = await db.organization.update({
      where: { oid: organization.oid },
      data: { nebulaTenantId: tenant.id }
    });
  }

  return { tenantId: organization.nebulaTenantId!, ownerId: organization.id };
};

// Nebula checks the proof on every use, so it must be derived only from values that never change
// for the lifetime of the secret.
let proofFor = (connectionId: string, ownerId: string) => ({
  aiGatewayConnectionId: connectionId,
  ownerId
});

let encryptionContextFor = (connectionId: string, ownerId: string) => ({
  aiGatewayConnectionId: connectionId,
  aiGatewayOwnerId: ownerId
});

export let createConnectionSecret = async (d: {
  owner: SecretOwner;
  connectionId: string;
  credentials: ProviderCredentials;
}) => {
  let tenant = await resolveTenant(d.owner);

  let secret = await getNebulaClient().secret.create({
    tenantId: tenant.tenantId,
    purpose: secretPurpose,
    secret: JSON.stringify(d.credentials),
    proof: proofFor(d.connectionId, tenant.ownerId),
    encryptionContext: encryptionContextFor(d.connectionId, tenant.ownerId)
  });

  return secret.id;
};

export let updateConnectionSecret = async (d: {
  owner: SecretOwner;
  connectionId: string;
  nebulaSecretId: string;
  credentials: ProviderCredentials;
}) => {
  let tenant = await resolveTenant(d.owner);

  await getNebulaClient().secret.update({
    tenantId: tenant.tenantId,
    secretId: d.nebulaSecretId,
    secret: JSON.stringify(d.credentials),
    proof: proofFor(d.connectionId, tenant.ownerId),
    encryptionContext: encryptionContextFor(d.connectionId, tenant.ownerId)
  });
};

export let readConnectionSecret = async (d: {
  owner: SecretOwner;
  connectionId: string;
  nebulaSecretId: string;
  note: string;
}) => {
  let tenant = await resolveTenant(d.owner);

  let used = await getNebulaClient().secret.use({
    tenantId: tenant.tenantId,
    secretId: d.nebulaSecretId,
    proof: proofFor(d.connectionId, tenant.ownerId),
    note: d.note
  });

  return JSON.parse(used.plaintext) as ProviderCredentials;
};

export let disableConnectionSecret = async (d: {
  owner: SecretOwner;
  nebulaSecretId: string;
}) => {
  let tenant = await resolveTenant(d.owner);

  await getNebulaClient().secret.disable({
    tenantId: tenant.tenantId,
    secretId: d.nebulaSecretId
  });
};
