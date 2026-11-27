import type { ProviderDeployment, Tenant } from '@metorial-subspace/db';
import { IProviderFunctionality } from '../providerFunctionality';

export abstract class IProviderEnclaveInstanceConfiguration extends IProviderFunctionality {
  abstract syncEnclaveInstanceConfiguration(
    data: ProviderEnclaveInstanceConfigurationSyncParam
  ): Promise<void>;
}

export interface ProviderEnclaveInstanceConfigurationSyncParam {
  tenant: Tenant;
  providerDeployment: ProviderDeployment;
  enclaveId: string;
  egressPolicy: PrismaJson.CompiledEgressNetworkAllowList;
}
