import type { Enclave, EnclaveEnvironment } from '@metorial-subspace/db';

export let enclaveEnvironmentPreviewPresenter = (enclaveEnvironment: EnclaveEnvironment) => ({
  object: 'enclave.environment#preview',

  id: enclaveEnvironment.id,
  name: enclaveEnvironment.name,
  type: enclaveEnvironment.type,

  createdAt: enclaveEnvironment.createdAt
});

export let enclavePresenter = (
  enclave: Enclave & {
    enclaveEnvironment: EnclaveEnvironment;
    network: { id: string };
    providerDeployment: { id: string };
  }
) => ({
  object: 'enclave',

  id: enclave.id,
  slug: enclave.slug,
  name: enclave.name,
  description: enclave.description,

  networkId: enclave.network.id,
  providerDeploymentId: enclave.providerDeployment.id,
  enclaveEnvironment: enclaveEnvironmentPreviewPresenter(enclave.enclaveEnvironment),

  createdAt: enclave.createdAt,
  lastUsedAt: enclave.lastUsedAt
});
