import type {
  ContentPolicy,
  CredentialKind,
  IngestChannel,
  IngestTokenLimits
} from '@mtsrc/agent-tracking-spec';
import { normalizeClient } from './clients';
import type {
  IngestTag,
  InstanceSettings,
  OrganizationSettings
} from '@mtsrc/agent-tracking-spec';
import { channelNotAllowedError, clientNotAllowedError } from './principalErrors';

export type IngestDeviceBinding = 'bound' | 'ephemeral' | 'vendor';

export type IngestPrincipal = {
  credential: { kind: CredentialKind; id: string; family?: string };

  contentPolicy: ContentPolicy;
  limits: IngestTokenLimits;
  allowedClients: string[];
  allowedChannels: IngestChannel[];

  tags: IngestTag[];

  binding: {
    userId?: string;
    deviceId?: string;
    deviceMode: IngestDeviceBinding;
    agentId?: string;
  };

  organization: {
    id: string;
    ref: string;
    hashKeyVersion: number;
    contentKeyVersion: number;
    settings: OrganizationSettings;
  };

  project: { id: string; ref: string };

  instance: {
    id: string;
    ref: string;
    skewBoundSeconds: number;
    backfillMaxAgeDays: number | null;
    recordRetentionDays: number;
    contentRetentionDays: number;
    usageRetentionDays: number;
    settings: InstanceSettings;
  };

  newUserLimitPerDay?: number;
};

let allows = (allowed: readonly string[], value: string) =>
  allowed.length == 0 || allowed.includes(value);

export let isClientAllowed = (principal: IngestPrincipal, client: string) => {
  let slug = normalizeClient(client);
  if (!slug) return false;

  return allows(
    principal.allowedClients.map(allowed => normalizeClient(allowed) ?? allowed),
    slug
  );
};

export let isChannelAllowed = (principal: IngestPrincipal, channel: string) =>
  allows(principal.allowedChannels, channel);

export let assertIngestAllowed = (
  principal: IngestPrincipal,
  target: { client?: string; channel?: string }
) => {
  if (target.client && !isClientAllowed(principal, target.client))
    return clientNotAllowedError();
  if (target.channel && !isChannelAllowed(principal, target.channel)) {
    return channelNotAllowedError();
  }

  return null;
};
