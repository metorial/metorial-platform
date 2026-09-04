import type { Environment, Solution, Tenant } from '@metorial-subspace/db';
import type { ProviderInvocationSourceType } from '../lib/providerInvocationId';
import { IProviderFunctionality } from '../providerFunctionality';

export interface ProviderInvocation {
  id: string;
  source: 'slates' | 'shuttle' | 'native';
  type: 'tool_call' | 'auth_config_event' | 'oauth_setup' | 'unknown';
  status: 'succeeded' | 'failed' | 'processing' | 'unknown';

  providerRunIds: string[];
  sessionMessageIds: string[];
  authConfigEventIds: string[];
  providerOAuthSetupIds: string[];

  toolCallId: string | null;

  action: {
    id: string;
    key: string;
    name: string;
  } | null;

  requests: any[];
  responses: any[];
  requestTraces: any[];
  logs: Array<{
    timestamp: number | Date;
    message: string;
    outputType?: string | null;
  }>;
  attachments: any[];

  error: {
    code: string;
    message: string;
  } | null;

  provider: Record<string, any> | null;
  metadata: Record<string, any> | null;

  createdAt: Date;
}

export interface ProviderInvocationListParam {
  tenant: Tenant;
  inputs: {
    providerRunIds?: string[];
    sessionMessageIds?: string[];
    callbackEventSourceIds?: string[];
    authConfigEventIds?: string[];
  };
}

export interface ProviderInvocationListRes {
  items: ProviderInvocation[];
}

export interface ProviderInvocationGetParam {
  tenant: Tenant;
  solution: Solution;
  environment: Environment;
  input: {
    providerInvocationId: string;
    sourceType: ProviderInvocationSourceType;
    sourceId: string;
  };
}

export abstract class IProviderInvocation extends IProviderFunctionality {
  abstract listProviderInvocations(
    data: ProviderInvocationListParam
  ): Promise<ProviderInvocationListRes>;

  abstract getProviderInvocation(
    data: ProviderInvocationGetParam
  ): Promise<ProviderInvocation | null>;
}
