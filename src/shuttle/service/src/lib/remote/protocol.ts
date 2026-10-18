import type { ServerRemoteProtocol } from '../../../prisma/generated/client';

export let STATELESS_PROTOCOL_DETECTED_CODE = 'stateless_protocol_detected';

export let getAutoSwitchRemoteProtocol = (
  current: ServerRemoteProtocol | null,
  errorCode: string | null | undefined
): ServerRemoteProtocol => {
  if (current == 'stateless') return 'streamable_http';
  if (current == 'sse') return 'streamable_http';

  if (errorCode == STATELESS_PROTOCOL_DETECTED_CODE) return 'stateless';
  return 'sse';
};
