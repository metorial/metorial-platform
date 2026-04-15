import type {
  FunctionBayLayer,
  FunctionBayRuntimeConfig,
  FunctionBayRuntimeSpec
} from '@function-bay/types';
import type {
  Function,
  FunctionDeployment,
  FunctionVersion,
  Provider,
  Runtime
} from '../../prisma/generated/client';
import type { ForgeWorkflowStep } from '../forge';

export interface ProviderRuntimeResult {
  runtime: Runtime;
  spec: FunctionBayRuntimeSpec;
  layer: FunctionBayLayer;
  workflow: ForgeWorkflowStep[];
  identifier: string;
}

export interface ProviderDeployFunctionParams {
  functionVersion: { id: string };
  function: Function;
  functionDeployment: FunctionDeployment;
  runtimeConfig: FunctionBayRuntimeConfig;
  runtime: Runtime;
  env: Record<string, string>;
  zipFileUrl: string;
}

export interface ProviderDeployFunctionResult {
  providerData: Record<string, any>;
}

export interface FunctionInvocationParams {
  functionVersion: FunctionVersion;
  function: Function;
  payload: Record<string, any>;
  providerData: any;
}

export type FunctionInvocationResult = (
  | {
      type: 'success';
      result: any;
    }
  | {
      type: 'error';
      error: {
        code: any;
        message: any;
      };
      internalError?: string;
    }
) & {
  logs: [number, string][];
  computeTimeMs: number;
  billedTimeMs: number;
};

export class ProviderImpl {
  #provider: Provider;
  #workflow: ForgeWorkflowStep[];
  #getRuntime: (runtime: FunctionBayRuntimeSpec) => Promise<ProviderRuntimeResult>;
  #deployFunction: (
    params: ProviderDeployFunctionParams
  ) => Promise<ProviderDeployFunctionResult>;
  #invokeFunction: (d: FunctionInvocationParams) => Promise<FunctionInvocationResult>;

  constructor(d: {
    provider: Provider;
    workflow: ForgeWorkflowStep[];
    getRuntime: (runtime: FunctionBayRuntimeSpec) => Promise<ProviderRuntimeResult>;
    deployFunction: (
      params: ProviderDeployFunctionParams
    ) => Promise<ProviderDeployFunctionResult>;
    invokeFunction: (d: FunctionInvocationParams) => Promise<FunctionInvocationResult>;
  }) {
    this.#provider = d.provider;
    this.#workflow = d.workflow;
    this.#getRuntime = d.getRuntime;
    this.#deployFunction = d.deployFunction;
    this.#invokeFunction = d.invokeFunction;
  }

  get identifier() {
    return this.#provider.identifier;
  }

  get provider() {
    return this.#provider;
  }

  get workflow() {
    return this.#workflow;
  }

  get getRuntime() {
    return this.#getRuntime;
  }

  get deployFunction() {
    return this.#deployFunction;
  }

  get invokeFunction() {
    return this.#invokeFunction;
  }
}
