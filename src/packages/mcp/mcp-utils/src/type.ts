import { type JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';

export let getMessageType = (msg: JSONRPCMessage) => {
  if ('error' in msg) return 'error' as const;
  if ('method' in msg) {
    if ('id' in msg) return 'request' as const;
    return 'notification' as const;
  }
  if ('result' in msg) return 'response' as const;

  return 'unknown' as const;
};
