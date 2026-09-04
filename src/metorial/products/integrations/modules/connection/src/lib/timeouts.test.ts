import { describe, expect, it } from 'vitest';
import {
  CONDUIT_CONNECTION_MAX_PROCESSING_MS,
  EPHEMERAL_MESSAGE_TTL_EXTENSION_MS,
  MAX_MESSAGE_PROCESSING_TIMEOUT_MS,
  resolveConnectionTimeouts
} from './timeouts';

let runtimeBehavior = {
  connectTimeoutMs: 30_000,
  requestTimeoutMs: 120_000,
  messageTtlExtensionMs: 120_000
};

let tenantTimeouts = [null, undefined, 1, 5_000, 30_000, 120_000, 10 * 60 * 1000, 60 * 60 * 1000];

describe('resolveConnectionTimeouts', () => {
  it('keeps connect < request < message processing < receiver ceiling', () => {
    for (let tenantMessageProcessingTimeoutMs of tenantTimeouts) {
      for (let isEphemeral of [true, false]) {
        let timeouts = resolveConnectionTimeouts({
          runtimeBehavior,
          tenantMessageProcessingTimeoutMs,
          isEphemeral
        });

        expect(timeouts.connectTimeoutMs).toBeLessThanOrEqual(timeouts.requestTimeoutMs);
        expect(timeouts.requestTimeoutMs).toBeLessThan(timeouts.messageProcessingTimeoutMs);
        expect(timeouts.messageProcessingTimeoutMs).toBeLessThanOrEqual(
          MAX_MESSAGE_PROCESSING_TIMEOUT_MS
        );
        expect(timeouts.messageProcessingTimeoutMs).toBeLessThan(
          CONDUIT_CONNECTION_MAX_PROCESSING_MS
        );
      }
    }
  });

  it('caps the tenant configured timeout at the maximum', () => {
    let timeouts = resolveConnectionTimeouts({
      runtimeBehavior,
      tenantMessageProcessingTimeoutMs: 60 * 60 * 1000,
      isEphemeral: false
    });

    expect(timeouts.messageProcessingTimeoutMs).toBe(MAX_MESSAGE_PROCESSING_TIMEOUT_MS);
  });

  it('shortens the ttl extension for ephemeral connections', () => {
    let timeouts = resolveConnectionTimeouts({
      runtimeBehavior,
      tenantMessageProcessingTimeoutMs: null,
      isEphemeral: true
    });

    expect(timeouts.messageTtlExtensionMs).toBe(EPHEMERAL_MESSAGE_TTL_EXTENSION_MS);
  });
});
