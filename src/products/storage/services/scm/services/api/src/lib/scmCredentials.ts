import type {
  Prisma,
  ScmBackend,
  ScmInstallation,
  ScmRepositoryWebhook
} from '../../prisma/generated/client';
import { db } from '../db';
import { delegateSecretsToNebula } from '../env';
import { getId } from '../id';
import { getNebulaClient, getNebulaTenantForOriginTenant } from '../nebula';

let STABLE_SECRET_TTL_MS = 60_000;
let STABLE_SECRET_MAX_ENTRIES = 500;

type ScmSecretPurpose =
  | 'scm_installation_tokens'
  | 'scm_backend_client_secret'
  | 'scm_backend_app_private_key'
  | 'scm_backend_app_webhook_secret'
  | 'scm_webhook_signing_secret';

type InstallationTokensPayload = {
  accessToken: string;
  refreshToken: string | null;
};

type SingleValuePayload = { value: string };

export type InstallationTokens = {
  accessToken: string | null;
  refreshToken: string | null;
};

export type RefreshedInstallationTokens = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
};

let backendFields = {
  clientSecret: {
    purpose: 'scm_backend_client_secret',
    pointer: 'clientSecretNebulaSecretId'
  },
  appPrivateKey: {
    purpose: 'scm_backend_app_private_key',
    pointer: 'appPrivateKeyNebulaSecretId'
  },
  appWebhookSecret: {
    purpose: 'scm_backend_app_webhook_secret',
    pointer: 'appWebhookSecretNebulaSecretId'
  }
} as const;

export type BackendSecretField = keyof typeof backendFields;

type BackendSecretPointer = (typeof backendFields)[BackendSecretField]['pointer'];

type BackendSecretRow = Pick<ScmBackend, 'id' | 'tenantOid' | BackendSecretField> &
  Pick<ScmBackend, BackendSecretPointer>;

export type BackendSecretPatch = {
  [Field in BackendSecretField]?: string | null;
} & {
  [Pointer in BackendSecretPointer]?: string;
};

type InstallationTokenRow = Pick<
  ScmInstallation,
  'id' | 'oid' | 'tenantOid' | 'accessToken' | 'refreshToken' | 'tokensNebulaSecretId'
>;

type WebhookSecretRow = Pick<
  ScmRepositoryWebhook,
  'id' | 'signingSecret' | 'signingSecretNebulaSecretId'
>;

let stableSecrets = new Map<string, { value: string; expiresAt: number }>();
let stableSecretReads = new Map<string, Promise<string>>();

let describeSecret = async (d: {
  tenantOid: bigint;
  resourceId: string;
  purpose: ScmSecretPurpose;
}) => {
  let tenant = await getNebulaTenantForOriginTenant(d.tenantOid);

  return {
    nebulaTenantId: tenant.nebulaTenantId,
    proof: {
      originResourceId: d.resourceId,
      tenantId: tenant.id,
      purpose: d.purpose
    },
    encryptionContext: {
      originTenantId: tenant.id,
      originResourceId: d.resourceId
    }
  };
};

let createNebulaSecret = async (d: {
  tenantOid: bigint;
  resourceId: string;
  purpose: ScmSecretPurpose;
  payload: InstallationTokensPayload | SingleValuePayload;
}) => {
  let description = await describeSecret(d);

  let secret = await getNebulaClient().secret.create({
    tenantId: description.nebulaTenantId,
    purpose: d.purpose,
    secret: JSON.stringify(d.payload),
    proof: description.proof,
    encryptionContext: description.encryptionContext
  });

  return secret.id;
};

let updateNebulaSecret = async (d: {
  tenantOid: bigint;
  resourceId: string;
  purpose: ScmSecretPurpose;
  nebulaSecretId: string;
  payload: InstallationTokensPayload | SingleValuePayload;
}) => {
  let description = await describeSecret(d);

  await getNebulaClient().secret.update({
    tenantId: description.nebulaTenantId,
    secretId: d.nebulaSecretId,
    secret: JSON.stringify(d.payload),
    proof: description.proof,
    encryptionContext: description.encryptionContext
  });

  stableSecrets.delete(d.nebulaSecretId);
};

let useNebulaSecret = async <Payload>(d: {
  tenantOid: bigint;
  resourceId: string;
  purpose: ScmSecretPurpose;
  nebulaSecretId: string;
  note: string;
}) => {
  let description = await describeSecret(d);

  let used = await getNebulaClient().secret.use({
    tenantId: description.nebulaTenantId,
    secretId: d.nebulaSecretId,
    proof: description.proof,
    note: d.note
  });

  return JSON.parse(used.plaintext) as Payload;
};

let readStableNebulaSecret = async (d: {
  tenantOid: bigint;
  resourceId: string;
  purpose: ScmSecretPurpose;
  nebulaSecretId: string;
  note: string;
}) => {
  let cached = stableSecrets.get(d.nebulaSecretId);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  let inFlight = stableSecretReads.get(d.nebulaSecretId);
  if (inFlight) return await inFlight;

  let read = (async () => {
    let payload = await useNebulaSecret<SingleValuePayload>(d);

    if (stableSecrets.size >= STABLE_SECRET_MAX_ENTRIES) {
      stableSecrets.delete(stableSecrets.keys().next().value!);
    }

    stableSecrets.set(d.nebulaSecretId, {
      value: payload.value,
      expiresAt: Date.now() + STABLE_SECRET_TTL_MS
    });

    return payload.value;
  })();

  stableSecretReads.set(d.nebulaSecretId, read);

  try {
    return await read;
  } finally {
    stableSecretReads.delete(d.nebulaSecretId);
  }
};

export let discardNebulaSecrets = async (d: {
  tenantOid: bigint | null;
  nebulaSecretIds: (string | null | undefined)[];
}) => {
  if (d.tenantOid == null) return;

  for (let nebulaSecretId of d.nebulaSecretIds) {
    if (!nebulaSecretId) continue;

    try {
      let tenant = await getNebulaTenantForOriginTenant(d.tenantOid);

      await getNebulaClient().secret.disable({
        tenantId: tenant.nebulaTenantId,
        secretId: nebulaSecretId
      });
    } catch (error) {
      console.warn('Could not disable Nebula secret', nebulaSecretId, error);
    } finally {
      stableSecrets.delete(nebulaSecretId);
    }
  }
};

export let hasInstallationTokens = (
  installation: Pick<ScmInstallation, 'accessToken' | 'tokensNebulaSecretId'>
) => !!(installation.accessToken || installation.tokensNebulaSecretId);

export let readInstallationTokens = async (
  installation: InstallationTokenRow,
  note: string
): Promise<InstallationTokens> => {
  if (!installation.tokensNebulaSecretId) {
    return {
      accessToken: installation.accessToken,
      refreshToken: installation.refreshToken
    };
  }

  let tokens = await useNebulaSecret<InstallationTokensPayload>({
    tenantOid: installation.tenantOid,
    resourceId: installation.id,
    purpose: 'scm_installation_tokens',
    nebulaSecretId: installation.tokensNebulaSecretId,
    note
  });

  return {
    accessToken: tokens.accessToken ?? null,
    refreshToken: tokens.refreshToken ?? null
  };
};

export let writeRefreshedInstallationTokens = async (
  installation: InstallationTokenRow,
  refreshed: RefreshedInstallationTokens
) => {
  let payload = { accessToken: refreshed.accessToken, refreshToken: refreshed.refreshToken };

  if (installation.tokensNebulaSecretId) {
    await updateNebulaSecret({
      tenantOid: installation.tenantOid,
      resourceId: installation.id,
      purpose: 'scm_installation_tokens',
      nebulaSecretId: installation.tokensNebulaSecretId,
      payload
    });

    await db.scmInstallation.update({
      where: { oid: installation.oid },
      data: { accessTokenExpiresAt: refreshed.expiresAt }
    });

    return;
  }

  if (!delegateSecretsToNebula) {
    await db.scmInstallation.update({
      where: { oid: installation.oid },
      data: {
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken,
        accessTokenExpiresAt: refreshed.expiresAt
      }
    });

    return;
  }

  let nebulaSecretId = await createNebulaSecret({
    tenantOid: installation.tenantOid,
    resourceId: installation.id,
    purpose: 'scm_installation_tokens',
    payload
  });

  try {
    await db.scmInstallation.update({
      where: { oid: installation.oid },
      data: {
        tokensNebulaSecretId: nebulaSecretId,
        accessToken: null,
        refreshToken: null,
        accessTokenExpiresAt: refreshed.expiresAt
      }
    });
  } catch (error) {
    await discardNebulaSecrets({
      tenantOid: installation.tenantOid,
      nebulaSecretIds: [nebulaSecretId]
    });

    throw error;
  }
};

export let upsertInstallationWithTokens = async (
  base: Omit<Prisma.ScmInstallationUncheckedCreateInput, 'oid' | 'id'>,
  tokens: RefreshedInstallationTokens
) => {
  let tenantOid = BigInt(base.tenantOid);

  let where = {
    tenantOid_provider_backendOid_externalAccountId: {
      tenantOid,
      provider: base.provider,
      backendOid: base.backendOid,
      externalAccountId: base.externalAccountId
    }
  };

  let existing = await db.scmInstallation.findUnique({ where });
  let ids = getId('scmInstallation');

  let resourceId = existing?.id ?? ids.id;
  let payload = { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
  let createdNebulaSecretId: string | null = null;
  let tokenData: Prisma.ScmInstallationUncheckedUpdateInput;

  if (existing?.tokensNebulaSecretId) {
    await updateNebulaSecret({
      tenantOid,
      resourceId,
      purpose: 'scm_installation_tokens',
      nebulaSecretId: existing.tokensNebulaSecretId,
      payload
    });

    tokenData = { accessTokenExpiresAt: tokens.expiresAt };
  } else if (delegateSecretsToNebula) {
    createdNebulaSecretId = await createNebulaSecret({
      tenantOid,
      resourceId,
      purpose: 'scm_installation_tokens',
      payload
    });

    tokenData = {
      tokensNebulaSecretId: createdNebulaSecretId,
      accessToken: null,
      refreshToken: null,
      accessTokenExpiresAt: tokens.expiresAt
    };
  } else {
    tokenData = {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      accessTokenExpiresAt: tokens.expiresAt
    };
  }

  try {
    return await db.scmInstallation.upsert({
      where,
      update: { ...base, ...tokenData },
      create: { ...ids, ...base, ...(tokenData as object) }
    });
  } catch (error) {
    await discardNebulaSecrets({
      tenantOid,
      nebulaSecretIds: [createdNebulaSecretId]
    });

    throw error;
  }
};

export let hasBackendSecret = (backend: BackendSecretRow, field: BackendSecretField) =>
  !!(backend[field] || backend[backendFields[field].pointer]);

export let readBackendSecret = async (
  backend: BackendSecretRow,
  field: BackendSecretField,
  note: string
) => {
  let definition = backendFields[field];
  let nebulaSecretId = backend[definition.pointer];

  if (!nebulaSecretId) return backend[field];
  if (backend.tenantOid == null) throw new Error('Delegated backend secret has no tenant');

  return await readStableNebulaSecret({
    tenantOid: backend.tenantOid,
    resourceId: backend.id,
    purpose: definition.purpose,
    nebulaSecretId,
    note
  });
};

export let writeBackendSecrets = async (d: {
  backend: BackendSecretRow;
  secrets: { [Field in BackendSecretField]?: string };
}) => {
  let patch: BackendSecretPatch = {};
  let createdNebulaSecretIds: string[] = [];

  for (let field of Object.keys(backendFields) as BackendSecretField[]) {
    let value = d.secrets[field];
    if (value === undefined) continue;

    let definition = backendFields[field];
    let nebulaSecretId = d.backend[definition.pointer];
    let payload = { value };

    if (nebulaSecretId && d.backend.tenantOid != null) {
      await updateNebulaSecret({
        tenantOid: d.backend.tenantOid,
        resourceId: d.backend.id,
        purpose: definition.purpose,
        nebulaSecretId,
        payload
      });
    } else if (delegateSecretsToNebula && d.backend.tenantOid != null) {
      let createdId = await createNebulaSecret({
        tenantOid: d.backend.tenantOid,
        resourceId: d.backend.id,
        purpose: definition.purpose,
        payload
      });

      createdNebulaSecretIds.push(createdId);
      patch[field] = null;
      patch[definition.pointer] = createdId;
    } else {
      patch[field] = value;
    }
  }

  return { patch, createdNebulaSecretIds };
};

export let discardBackendSecrets = async (backend: BackendSecretRow) =>
  await discardNebulaSecrets({
    tenantOid: backend.tenantOid,
    nebulaSecretIds: Object.values(backendFields).map(
      definition => backend[definition.pointer]
    )
  });

export let stageWebhookSigningSecret = async (d: {
  tenantOid: bigint;
  webhookId: string;
  signingSecret: string;
}) => {
  if (!delegateSecretsToNebula) {
    return { signingSecret: d.signingSecret, signingSecretNebulaSecretId: null };
  }

  let nebulaSecretId = await createNebulaSecret({
    tenantOid: d.tenantOid,
    resourceId: d.webhookId,
    purpose: 'scm_webhook_signing_secret',
    payload: { value: d.signingSecret }
  });

  return { signingSecret: null, signingSecretNebulaSecretId: nebulaSecretId };
};

export let readWebhookSigningSecret = async (
  webhook: WebhookSecretRow,
  tenantOid: bigint,
  note: string
) => {
  if (!webhook.signingSecretNebulaSecretId) {
    if (!webhook.signingSecret) throw new Error('Webhook signing secret is missing');

    return webhook.signingSecret;
  }

  return await readStableNebulaSecret({
    tenantOid,
    resourceId: webhook.id,
    purpose: 'scm_webhook_signing_secret',
    nebulaSecretId: webhook.signingSecretNebulaSecretId,
    note
  });
};
