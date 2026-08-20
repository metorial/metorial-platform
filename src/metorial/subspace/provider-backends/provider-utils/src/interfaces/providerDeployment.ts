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

  abstract deleteProviderDeployment(
    data: ProviderDeploymentDeleteParam
  ): Promise<ProviderDeploymentDeleteRes>;

  abstract createProviderConfig(
    data: ProviderConfigCreateParam
  ): Promise<ProviderConfigCreateRes>;

  async updateProviderConfig(
    _data: ProviderConfigUpdateParam
  ): Promise<ProviderConfigUpdateRes> {
    throw new Error('Provider backend does not support post-creation config updates');
  }

  abstract deleteProviderConfig(
    data: ProviderConfigDeleteParam
  ): Promise<ProviderConfigDeleteRes>;
}

export interface ProviderDeploymentCreateParam {
  tenant: Tenant;
  id: string;
  provider: Provider;
  providerVariant: ProviderVariant;
  lockedVersion: ProviderVersion | null;
}

export interface ProviderDeploymentCreateRes {}

export interface ProviderDeploymentDeleteParam {
  tenant: Tenant;
}

export interface ProviderDeploymentDeleteRes {}

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

export interface ProviderConfigPatch {
  set?: Record<string, unknown>;
  remove?: string[];
}

export interface ProviderConfigUpdateParam {
  tenant: Tenant;
  backing: ProviderConfigDeleteBacking;
  patch: ProviderConfigPatch;
  expectedGeneration?: number;
}

export interface ProviderConfigUpdateRes {
  configGeneration?: number | null;
}

export interface ProviderConfigDeleteBacking {
  slateInstanceOid?: bigint | null;
  shuttleConfigOid?: bigint | null;
}

export interface ProviderConfigDeleteParam {
  tenant: Tenant;
  backing: ProviderConfigDeleteBacking;
}

export interface ProviderConfigDeleteRes {}
