import type { ProviderRuntimeBehavior } from '@metorial-subspace/provider-utils';

export let DEFAULT_MESSAGE_PROCESSING_TIMEOUT_MS = 30_000;
export let MIN_MESSAGE_PROCESSING_TIMEOUT_MS = 5_000;
export let MAX_MESSAGE_PROCESSING_TIMEOUT_MS = 10 * 60 * 1000;

export let CONDUIT_CONNECTION_MAX_PROCESSING_MS = 20 * 60 * 1000;

export let EPHEMERAL_MESSAGE_TTL_EXTENSION_MS = 15_000;

export let CONNECTION_TOOL_DISCOVERY_TIMEOUT_MS = 30_000;

export let CONNECTION_DIAGNOSTICS_TIMEOUT_MS = 5_000;

let REQUEST_TIMEOUT_HEADROOM_MS = 3_000;
let MIN_REQUEST_TIMEOUT_MS = 2_000;

export interface ConnectionTimeouts {
  connectTimeoutMs: number;
  requestTimeoutMs: number;
  messageTtlExtensionMs: number;
  messageProcessingTimeoutMs: number;
}

let clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export let resolveConnectionTimeouts = (d: {
  runtimeBehavior: ProviderRuntimeBehavior;
  tenantMessageProcessingTimeoutMs: number | null | undefined;
  isEphemeral: boolean;
}): ConnectionTimeouts => {
  let messageProcessingTimeoutMs = clamp(
    d.tenantMessageProcessingTimeoutMs ?? DEFAULT_MESSAGE_PROCESSING_TIMEOUT_MS,
    MIN_MESSAGE_PROCESSING_TIMEOUT_MS,
    MAX_MESSAGE_PROCESSING_TIMEOUT_MS
  );

  let requestTimeoutMs = clamp(
    Math.min(
      d.runtimeBehavior.requestTimeoutMs,
      messageProcessingTimeoutMs - REQUEST_TIMEOUT_HEADROOM_MS
    ),
    MIN_REQUEST_TIMEOUT_MS,
    messageProcessingTimeoutMs - 1
  );

  let connectTimeoutMs = clamp(
    Math.min(d.runtimeBehavior.connectTimeoutMs, requestTimeoutMs),
    MIN_REQUEST_TIMEOUT_MS,
    requestTimeoutMs
  );

  return {
    connectTimeoutMs,
    requestTimeoutMs,
    messageTtlExtensionMs: d.isEphemeral
      ? EPHEMERAL_MESSAGE_TTL_EXTENSION_MS
      : d.runtimeBehavior.messageTtlExtensionMs,
    messageProcessingTimeoutMs
  };
};
