import { createClient } from '@lowerdeck/rpc-client';
import { env } from '../env';

export let CALLBACK_SECURITY_AUDIT_ACTIONS = [
  'secret_created',
  'secret_imported',
  'secret_projected',
  'secret_rotated',
  'secret_revoked',
  'secret_issuance_receipt_issued',
  'secret_issuance_receipt_consumed',
  'secret_issuance_receipt_denied'
] as const;

export type CallbackSecurityAuditAction = (typeof CALLBACK_SECURITY_AUDIT_ACTIONS)[number];

export type CallbackReceiverAuthority = {
  tenantId: string;
  receiverId: string;
  callbackId: string;
  callbackInstanceId: string;
  receiverAuthorityVersion: number;
};

export type CallbackSecretAuditContext = {
  trustedActorId: string;
  requestId: string;
  requestIp?: string;
  requestUserAgent?: string;
};

export type SecretIssuanceReceipt = {
  id: string;
  token: string;
  expiresAt: Date;
};

export type CallbackReceiverSecretMutation = {
  secret: {
    id: string;
    status: string;
    secretVersion: number;
    validFrom: Date;
    validUntil: Date | null;
  };
  secretIssuanceReceipt?: SecretIssuanceReceipt | null;
  graceExpiresAt?: Date | null;
  auditCorrelationId: string;
};

export type CallbackReceiverSecretBulkRevocation = {
  secrets: Array<{
    id: string;
    status: string;
    secretVersion: number;
    validFrom: Date;
    validUntil: Date | null;
  }>;
  revokedCount: number;
  auditCorrelationId: string;
};

export type HubCallbackSecurityAudit = {
  id: string;
  auditCorrelationId: string;
  action: CallbackSecurityAuditAction;
  actorId: string;
  requestId: string;
  requestIp: string | null;
  requestUserAgent: string | null;
  metadata: Record<string, string | number | boolean | null>;
  createdAt: Date;
  ownerSnapshot: {
    tenantId: string;
    receiverId: string;
    callbackId: string;
    callbackInstanceId: string;
    receiverAuthorityVersion: number;
    committedAt: Date;
  };
};

export interface CallbackReceiverSecretAuthorityClient {
  createReceiverPath(
    input: CallbackReceiverAuthority & CallbackSecretAuditContext
  ): Promise<CallbackReceiverSecretMutation>;
  rotateReceiverPath(
    input: CallbackReceiverAuthority & CallbackSecretAuditContext & { graceMs?: number }
  ): Promise<CallbackReceiverSecretMutation>;
  revokeReceiverPath(
    input: CallbackReceiverAuthority & CallbackSecretAuditContext & { secretId: string }
  ): Promise<CallbackReceiverSecretMutation>;
  revokeAllReceiverPath(
    input: CallbackReceiverAuthority & CallbackSecretAuditContext
  ): Promise<CallbackReceiverSecretBulkRevocation>;
  consumeReceiverPathReceipt(
    input: CallbackReceiverAuthority &
      CallbackSecretAuditContext & { receiptId: string; receiptToken: string }
  ): Promise<
    | { outcome: 'consumed'; plaintext: string; auditCorrelationId: string }
    | { outcome: 'denied'; auditCorrelationId: string }
  >;
  getReceiverSecretAuditByCorrelation(
    input: CallbackReceiverAuthority &
      CallbackSecretAuditContext & { auditCorrelationId: string }
  ): Promise<HubCallbackSecurityAudit>;
}

let overrideClient: CallbackReceiverSecretAuthorityClient | null = null;
let productionClient: CallbackReceiverSecretAuthorityClient | null = null;
export let slatesHubSubspaceSecretKeyIdHeader = 'metorial-subspace-secret-key-id';

export let configureCallbackReceiverSecretAuthority = (
  client: CallbackReceiverSecretAuthorityClient | null
) => {
  overrideClient = client;
};

export let getCallbackReceiverSecretAuthority = () => {
  if (overrideClient) return overrideClient;
  if (productionClient) return productionClient;
  let endpoint = env.service.SLATES_HUB_SECRET_RPC_URL;
  let token = env.service.SLATES_HUB_SUBSPACE_SECRET_RPC_TOKEN_CURRENT;
  if (!endpoint || !token) {
    throw new Error('Authenticated Hub callback secret authority is not configured');
  }
  productionClient = createClient<CallbackReceiverSecretAuthorityClient>({
    endpoint,
    getHeaders: () => ({ [slatesHubSubspaceSecretKeyIdHeader]: 'current' }),
    getSignatureToken: () => token,
    timeoutMs: 15_000
  });
  return productionClient;
};
