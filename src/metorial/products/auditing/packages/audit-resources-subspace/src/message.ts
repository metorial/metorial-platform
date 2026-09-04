import { v } from '@lowerdeck/validation';
import { resource } from '@metorial/audit-stash';
import type { SubspaceProviderSummary } from './_shared';

export type SubspaceMessageProviderSummary = {
  id: string;
  tag: string;
  provider: SubspaceProviderSummary;
};

export type SubspaceMessageToolCallSummary = {
  id: string;
  toolKey: string;
  rationale: string | null;
  operation: string | null;
};

export let sessionMessageAuditResource = resource({
  name: 'session_message',
  payload: v.typedAny<{
    id: string;
    status: string;
    type: string;
    source: string;
    transport: string;
    failureReason: string;
    isProductive: boolean;
    retentionLevel: string;
    sessionId: string;
    sessionProvider: SubspaceMessageProviderSummary | null;
    connectionId: string | null;
    /** Withheld at `none`. */
    methodOrToolKey: string | null;
    /** Withheld at `none`. */
    toolCall: SubspaceMessageToolCallSummary | null;
    createdAt: Date;
    completedAt: Date | null;
  }>('session_message'),
  presenter: undefined,
  actions: {
    create: true
  }
});

export let sessionConnectionAuditResource = resource({
  name: 'session_connection',
  payload: v.typedAny<{
    id: string;
    status: string;
    transport: string;
    mcpTransport: string;
    mcpProtocolVersion: string | null;
    isEphemeral: boolean;
    isForManualToolCalls: boolean;
    sessionId: string;
    client: { name: string | null; version: string | null };
    participant: {
      id: string;
      type: string;
      name: string;
      identityId: string | null;
      identityActorId: string | null;
    } | null;
    expiresAt: Date;
  }>('session_connection'),
  presenter: undefined,
  actions: {
    create: true
  }
});
