import type { Backend } from '@metorial-subspace/db/prisma/generated/client';

export abstract class IProviderFunctionality {
  protected readonly backend: Backend;

  constructor(params: ProviderFunctionalityCtorParams) {
    this.backend = params.backend;
  }
}

export interface ProviderFunctionalityCtorParams {
  backend: Backend;
}
