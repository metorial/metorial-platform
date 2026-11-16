import type { Enclave } from '../../prisma/generated/client';

export let enclavePresenter = (enclave: Enclave) => ({
  object: 'function_bay#enclave',

  id: enclave.id,
  identifier: enclave.identifier,
  name: enclave.name,

  createdAt: enclave.createdAt
});
