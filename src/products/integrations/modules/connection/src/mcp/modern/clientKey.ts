import { canonicalize } from '@lowerdeck/canonicalize';
import { Hash } from '@lowerdeck/hash';
import type { SenderMangerProps } from '../../sender';
import type { ModernClientInfo } from './types';

let IPV4_MAPPED_PREFIX = '::ffff:';
let IPV4_PATTERN = /^\d{1,3}(\.\d{1,3}){3}$/;

export let normalizeClientIp = (ip: string | null | undefined) => {
  let normalized = (ip ?? '').trim().toLowerCase();

  if (normalized.startsWith(IPV4_MAPPED_PREFIX)) {
    let mapped = normalized.slice(IPV4_MAPPED_PREFIX.length);
    if (IPV4_PATTERN.test(mapped)) return mapped;
  }

  return normalized;
};

export let getSessionlessClientIdentity = (clientInfo: ModernClientInfo | undefined) => {
  let name = clientInfo?.name?.trim() || 'unknown';
  let version = clientInfo?.version?.trim() ?? '';

  return { name, version, identifier: version ? `${name}@${version}` : name };
};

let getAgentClientPart = (agentClient: SenderMangerProps['agentClient']) => {
  if (!agentClient) return '';

  let base = `${agentClient.type}:${agentClient.foreignId}`;
  return agentClient.type === 'mcp_client_oauth'
    ? `${base}:${agentClient.oauthRegistrationId}`
    : base;
};

export let buildSessionlessClientKey = async (d: {
  clientInfo: ModernClientInfo | undefined;
  clientIp: string | null | undefined;
  agentClient: SenderMangerProps['agentClient'];
}) =>
  await Hash.sha256(
    canonicalize([
      getSessionlessClientIdentity(d.clientInfo).identifier,
      normalizeClientIp(d.clientIp),
      getAgentClientPart(d.agentClient)
    ])
  );
