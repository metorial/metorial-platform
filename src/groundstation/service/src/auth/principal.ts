import type { ContentPolicy, IngestTokenLimits } from '@metorial/groundstation-spec';
import { channelNotAllowedError, clientNotAllowedError } from './errors';

export type IngestPrincipal = {
  tokenId: string;
  principalRef: string | null;

  contentPolicy: ContentPolicy;
  limits: IngestTokenLimits;
  allowedClients: string[];
  allowedChannels: string[];

  tenant: {
    id: string;
    ref: string;
    skewBoundSeconds: number;
    backfillMaxAgeDays: number | null;
    hashKeyVersion: number;
  };
};

let allows = (allowed: string[], value: string) =>
  allowed.length == 0 || allowed.includes(value);

export let isClientAllowed = (principal: IngestPrincipal, client: string) =>
  allows(principal.allowedClients, client);

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
