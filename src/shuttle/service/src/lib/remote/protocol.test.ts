import { describe, expect, it } from 'vitest';
import { getAutoSwitchRemoteProtocol, STATELESS_PROTOCOL_DETECTED_CODE } from './protocol';

describe('getAutoSwitchRemoteProtocol', () => {
  it('falls back from stateless to session-based streamable HTTP', () => {
    expect(getAutoSwitchRemoteProtocol('stateless', 'stateless_protocol_unsupported')).toBe(
      'streamable_http'
    );
  });

  it('switches streamable HTTP to stateless when the server speaks the modern protocol', () => {
    expect(
      getAutoSwitchRemoteProtocol('streamable_http', STATELESS_PROTOCOL_DETECTED_CODE)
    ).toBe('stateless');
  });

  it('keeps the existing sse <-> streamable_http switch', () => {
    expect(getAutoSwitchRemoteProtocol('streamable_http', 'connection_error')).toBe('sse');
    expect(getAutoSwitchRemoteProtocol('streamable_http', null)).toBe('sse');
    expect(getAutoSwitchRemoteProtocol('sse', STATELESS_PROTOCOL_DETECTED_CODE)).toBe(
      'streamable_http'
    );
  });
});
