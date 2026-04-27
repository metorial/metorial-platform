import type {
  FunctionBayLayer,
  FunctionBayRuntimeConfig,
  FunctionBayRuntimeSpec
} from '@function-bay/types';
import type {
  Function,
  FunctionBundle,
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
  functionBundle?: FunctionBundle | null;
  egressPolicy?: {
    allowedIps?: string[];
    allowedHosts?: string[];
  };
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

export abstract class ProviderAdapter {
  abstract readonly provider: Provider;
  abstract readonly workflow: ForgeWorkflowStep[];

  abstract getRuntime(runtime: FunctionBayRuntimeSpec): Promise<ProviderRuntimeResult>;
  abstract deployFunction(
    params: ProviderDeployFunctionParams
  ): Promise<ProviderDeployFunctionResult>;
  abstract invokeFunction(d: FunctionInvocationParams): Promise<FunctionInvocationResult>;

  get identifier() {
    return this.provider.identifier;
  }
}

export class ProviderImpl extends ProviderAdapter {
  readonly provider: Provider;
  readonly workflow: ForgeWorkflowStep[];

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
    super();
    this.provider = d.provider;
    this.workflow = d.workflow;
    this.#getRuntime = d.getRuntime;
    this.#deployFunction = d.deployFunction;
    this.#invokeFunction = d.invokeFunction;
  }

  async getRuntime(runtime: FunctionBayRuntimeSpec) {
    return await this.#getRuntime(runtime);
  }

  async deployFunction(params: ProviderDeployFunctionParams) {
    return await this.#deployFunction(params);
  }

  async invokeFunction(d: FunctionInvocationParams) {
    return await this.#invokeFunction(d);
  }
}

export interface InvocationOutputs {
  logs: [number, string][];
  computeTimeMs: number;
  billedTimeMs: number;
}

export let parseInvocationPayload = (d: {
  payload: string | Uint8Array | Record<string, any> | null | undefined;
  outputs: InvocationOutputs;
  hasBootError?: boolean;
  internalError?: string;
}): FunctionInvocationResult => {
  try {
    let decodedPayload =
      typeof d.payload === 'string'
        ? d.payload
        : d.payload instanceof Uint8Array
          ? new TextDecoder().decode(d.payload)
          : JSON.stringify(d.payload ?? {});

    let body: { statusCode?: number; body?: { error?: Record<string, any>; result?: any } } =
      JSON.parse(decodedPayload);
    let statusCode = body.statusCode || 500;
    let result = body.body || {};

    if (statusCode == 200 && result.result) {
      return {
        type: 'success',
        result: result.result,
        ...d.outputs
      };
    }

    if (result.error) {
      return {
        type: 'error',
        error: {
          ...result.error,
          code: result.error.code || 'function_bay.function_error',
          message: result.error.message || 'Function invocation resulted in an error'
        },
        internalError: d.internalError,
        ...d.outputs
      };
    }

    let errorBody = body as any;
    if (errorBody?.errorType == 'Error' && typeof errorBody?.errorMessage == 'string') {
      let traceArr = errorBody?.trace && Array.isArray(errorBody.trace) ? errorBody.trace : [];
      let trace = traceArr.join('\n');

      return {
        type: 'error',
        error: {
          code: 'function_bay.function_error',
          message: `Function invocation resulted in an error:\nError ${errorBody.errorMessage}\n\n${trace}`
        },
        internalError: d.internalError,
        ...d.outputs
      };
    }

    if (d.hasBootError) {
      return {
        type: 'error',
        error: {
          code: 'function_bay.function_error',
          message:
            'Function threw an error during initialization. This is often due to the global/root scope throwing an error, or the code being malformed.'
        },
        internalError: d.internalError,
        ...d.outputs
      };
    }

    return {
      type: 'error',
      error: {
        code: 'function_bay.invalid_response',
        message: 'Function returned an invalid response'
      },
      internalError: d.internalError,
      ...d.outputs
    };
  } catch (err) {
    return {
      type: 'error',
      error: {
        code: 'function_bay.invalid_response',
        message: 'Function returned an invalid response'
      },
      internalError: d.internalError ?? String(err),
      ...d.outputs
    };
  }
};
