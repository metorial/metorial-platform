import type { Enclave } from '@metorial-subspace/db';

export let enclavePresenter = (
  enclave: Enclave & {
    enclaveEnvironment: { id: string };
    providerDeployment: { id: string };
  }
) => ({
  object: 'enclave',

  id: enclave.id,
  identifier: enclave.identifier,
  name: enclave.name,
  description: enclave.description,

  providerDeploymentId: enclave.providerDeployment.id,
  enclaveEnvironmentId: enclave.enclaveEnvironment.id,

  createdAt: enclave.createdAt
});
