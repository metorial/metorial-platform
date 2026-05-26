import type { Consumer, KeyProvider, Secret, SecretVersion } from '../../prisma/generated/client';

type SecretWithVersion = Secret & {
  consumer?: Consumer | null;
  currentVersion?: (SecretVersion & { keyProvider?: KeyProvider }) | null;
};

export let secretPresenter = (secret: SecretWithVersion) => ({
  object: 'nebula#secret',
  id: secret.id,
  purpose: secret.purpose,
  status: secret.status,
  consumerId: secret.consumer?.id ?? null,
  currentVersionId: secret.currentVersion?.id ?? null,
  keyProviderId: secret.currentVersion?.keyProvider?.id ?? null,
  createdAt: secret.createdAt,
  updatedAt: secret.updatedAt,
  disabledAt: secret.disabledAt,
  deletedAt: secret.deletedAt
});

export let secretVersionPresenter = (version: SecretVersion & { keyProvider?: KeyProvider }) => ({
  object: 'nebula#secret_version',
  id: version.id,
  alg: version.alg,
  keyProviderId: version.keyProvider?.id ?? null,
  createdAt: version.createdAt
});

export let secretUsePresenter = (d: { secret: SecretWithVersion; plaintext: string }) => ({
  object: 'nebula#secret_use',
  secretId: d.secret.id,
  plaintext: d.plaintext
});
