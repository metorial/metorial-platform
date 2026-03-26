import type {
  Provider,
  ProviderDeployment,
  ProviderDeploymentVersion,
  ProviderVariant,
  ProviderVersion,
  ShuttleServerConfig,
  SlateInstance,
  Tenant
} from '@metorial-subspace/db';
import { IProviderFunctionality } from '../providerFunctionality';

export abstract class IProviderDeployment extends IProviderFunctionality {
  abstract createProviderDeployment(
    data: ProviderDeploymentCreateParam
  ): Promise<ProviderDeploymentCreateRes>;

  abstract createProviderConfig(
    data: ProviderConfigCreateParam
  ): Promise<ProviderConfigCreateRes>;

  abstract validateNetworkingRulesetIds(
    data: ValidateNetworkingRulesetIdsParam
  ): Promise<ValidateNetworkingRulesetIdsRes>;
}

export interface ProviderDeploymentCreateParam {
  tenant: Tenant;
  id: string;
  provider: Provider;
  providerVariant: ProviderVariant;
  lockedVersion: ProviderVersion | null;
}

export interface ProviderDeploymentCreateRes {}

export interface ProviderConfigCreateParam {
  tenant: Tenant;
  provider: Provider;
  providerVariant: ProviderVariant;
  deployment:
    | (ProviderDeployment & {
        currentVersion:
          | (ProviderDeploymentVersion & { lockedVersion: ProviderVersion | null })
          | null;
      })
    | null;
  id: string;
  config: Record<string, any>;
}

export interface ProviderConfigCreateRes {
  slateInstance?: SlateInstance | null;
  shuttleServerConfig?: ShuttleServerConfig | null;
}

export interface ValidateNetworkingRulesetIdsParam {
  tenant: Tenant;
  provider: Provider;
  networkingRulesetIds: string[];
}

export interface ValidateNetworkingRulesetIdsRes {}
