import type {
  SlatesNotifications,
  SlatesParticipant,
  SlatesRequests,
  slatesRequestTrace,
  SlatesResponses,
  slatesResponsesByMethod
} from '@slates/proto';
import type z from 'zod';
import type { SlateInvocation, SlateVersion, Tenant } from '../../../prisma/generated/client';
import type { SlateInvocationProviderMetadata } from './store';

export interface SlateInvocationDeploymentTarget {
  providerDeploymentInfo: NonNullable<PrismaJson.SlateDeploymentProviderDeploymentInfo>;
  activeDeploymentOid: bigint;
}

export interface SlateInvocationBaseParams {
  tenant?: Pick<
    Tenant,
    'oid' | 'identifier' | 'name' | 'functionBayTenantId' | 'functionBayTenantIdentifier'
  >;
  slateVersion: SlateVersion;
  deploymentTarget?: SlateInvocationDeploymentTarget;
  participants: SlatesParticipant[];
  enclaveId?: string;
  egressPolicy?: PrismaJson.CompiledEgressNetworkAllowList;
}

export type SlatesRequest = SlatesNotifications | SlatesRequests;
export type SlatesResponse = SlatesNotifications | SlatesResponses;
export type SlatesRequestTrace = z.infer<typeof slatesRequestTrace>;

export interface InvocationError {
  code: string;
  message: string;
  kind?: string;
  retryable?: boolean;
  status?: number;
  [key: string]: unknown;
}

export type InvocationResult<Key extends keyof typeof slatesResponsesByMethod = any> =
  | {
      status: 'success';
      invocation: SlateInvocation;
      data: z.infer<(typeof slatesResponsesByMethod)[Key]>['result'];
    }
  | {
      status: 'error';
      invocation: SlateInvocation;
      error: InvocationError;
    };

export interface StoredSlateInvocation {
  id: string;
  requests: SlatesRequest[];
  responses: SlatesResponse[];
  logs: [number, string][];
  provider?: SlateInvocationProviderMetadata;
  requestTraces?: SlatesRequestTrace[];
}
