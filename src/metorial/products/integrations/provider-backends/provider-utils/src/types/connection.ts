import type { ProviderSpecificationType } from '@metorial-subspace/db';
import type { NormalizedProviderError } from '../lib/normalizeProviderError';
import type {
  Specification,
  SpecificationAuthMethod,
  SpecificationFeatures,
  SpecificationTool,
  SpecificationTrigger
} from './specification';

export interface ConnectionSpecificationBehavior {
  discoverPerConnection: boolean;
  mergeDiscoveredToolsIntoVersionSpecification: boolean;
  preserveExistingSpecificationOnEmptyDiscovery: boolean;
}

export type ConnectionToolListRes =
  | {
      status: 'success';
      type: ProviderSpecificationType;
      specification: Specification;
      features: SpecificationFeatures;
      tools: SpecificationTool[];
      authMethods: SpecificationAuthMethod[];
      triggers: SpecificationTrigger[];
    }
  | {
      status: 'failure';
      error: NormalizedProviderError;
    }
  | {
      status: 'not_supported';
    };

export type ConnectionDiagnosticsState = 'connecting' | 'connected' | 'failed' | 'closed';

export interface ConnectionDiagnostics {
  state: ConnectionDiagnosticsState;
  transport: string | null;
  protocolVersion: string | null;
  serverInfo: { name: string; version?: string; title?: string } | null;
  lastError: NormalizedProviderError | null;
}

export interface ProviderRuntimeBehavior {
  connectTimeoutMs: number;
  requestTimeoutMs: number;
  messageTtlExtensionMs: number;
}
