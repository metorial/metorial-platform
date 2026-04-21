import type { Tenant } from '@metorial-subspace/db';
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
    authConfigEventIds?: string[];
  };
}

export interface ProviderInvocationListRes {
  items: ProviderInvocation[];
}

export abstract class IProviderInvocation extends IProviderFunctionality {
  abstract listProviderInvocations(
    data: ProviderInvocationListParam
  ): Promise<ProviderInvocationListRes>;
}
