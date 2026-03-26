import type {
  Provider,
  ProviderAuthConfigVersion,
  ProviderConfigVersion,
  ProviderDeploymentVersion,
  ProviderSpecificationType,
  ProviderVariant,
  ProviderVersion,
  Tenant
} from '@metorial-subspace/db';
import { IProviderFunctionality } from '../providerFunctionality';
import type {
  Specification,
  SpecificationAuthMethod,
  SpecificationFeatures,
  SpecificationTool,
  SpecificationTrigger
} from '../types/specification';

export abstract class IProviderCapabilities extends IProviderFunctionality {
  abstract getSpecificationForProviderVersion(
    data: ProviderSpecificationGetForProviderParam
  ): Promise<ProviderSpecificationGetRes | null>;

  abstract getSpecificationForProviderPair(
    data: ProviderSpecificationGetForPairParam
  ): Promise<ProviderSpecificationGetRes>;

  abstract getSpecificationBehavior(
    data: ProviderSpecificationBehaviorParam
  ): Promise<ProviderSpecificationBehaviorRes>;

  abstract shouldDiscoverSpecificationForProviderPair(
    data: ProviderSpecificationGetForPairParam
  ): Promise<{ shouldDiscover: boolean }>;
}

export interface ProviderSpecificationGetForProviderParam {
  tenant: Tenant | null;
  provider: Provider;
  providerVariant: ProviderVariant;
  providerVersion: ProviderVersion;
}

export interface ProviderSpecificationGetForPairParam {
  tenant: Tenant;

  deploymentVersion: ProviderDeploymentVersion | null;
  configVersion: ProviderConfigVersion;
  authConfigVersion: ProviderAuthConfigVersion | null;

  provider: Provider;
  providerVariant: ProviderVariant;
  providerVersion: ProviderVersion;
}

export type ProviderSpecificationGetRes =
  | {
      status: 'success';
      specification: Specification;
      features: SpecificationFeatures;
      tools: SpecificationTool[];
      authMethods: SpecificationAuthMethod[];
      triggers: SpecificationTrigger[];
      type: ProviderSpecificationType;
      warnings?: {
        code: string;
        message: string;
        data?: any;
      }[];
    }
  | {
      status: 'failure';
      warnings?: {
        code: string;
        message: string;
        data?: any;
      }[];
      error:
        | {
            type: 'mcp_error';
            error: {
              code: number;
              message: string;
              data?: any;
            };
          }
        | {
            type: 'connection_error';
            error: {
              code: string;
              message?: string;
            };
          }
        | {
            type: 'timeout_error';
            message?: string;
          };
    }
  | null;

export interface ProviderSpecificationBehaviorParam {}

export interface ProviderSpecificationBehaviorRes {
  supportsVersionSpecification: boolean;
  supportsDeploymentSpecification: boolean;
}
