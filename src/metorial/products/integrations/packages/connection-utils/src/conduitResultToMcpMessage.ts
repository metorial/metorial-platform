import { messageTranslator } from '@metorial-subspace/db';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import type { ConduitResult } from './conduitMessage';

export let conduitResultToMcpMessage = async (
  msg: ConduitResult
): Promise<JSONRPCMessage | null> => {
  let output = msg.output ?? msg.message?.output;
  if (!output) return null;

  return messageTranslator.outputToMcpBasic(output, msg.message);
};
