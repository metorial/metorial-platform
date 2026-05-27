import type {
  SlatesNotifications,
  SlatesParticipant,
  SlatesRequests,
  slatesRequestTrace,
  SlatesResponses,
  slatesResponsesByMethod
} from '@slates/proto';
import type z from 'zod';
import type { SlateInvocation, SlateVersion } from '../../../prisma/generated/client';
import type { SlateInvocationProviderMetadata } from './store';

export interface SlateInvocationBaseParams {
  slateVersion: SlateVersion;
  participants: SlatesParticipant[];
}

export type SlatesRequest = SlatesNotifications | SlatesRequests;
export type SlatesResponse = SlatesNotifications | SlatesResponses;
export type SlatesRequestTrace = z.infer<typeof slatesRequestTrace>;

export interface InvocationError {
  code: string;
  message: string;
  [key: string]: string;
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
