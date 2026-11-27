import type { ServiceError } from '@lowerdeck/error';
import type { JSONRPCErrorResponse } from '@modelcontextprotocol/sdk/types.js';

export let serviceErrorToMcpError = ({ data: error }: ServiceError<any>) => {
  if (error.status === 404 && error.entity === 'tool') {
    return {
      jsonrpc: '2.0',
      error: {
        code: -32601,
        message: 'Method not found',
        data: error
      }
    } satisfies JSONRPCErrorResponse;
  }

  if (error.status === 400 || error.status === 406) {
    return {
      jsonrpc: '2.0',
      error: {
        code: -32602,
        message: 'Invalid params',
        data: error
      }
    } satisfies JSONRPCErrorResponse;
  }

  if (error.status === 500) {
    return {
      jsonrpc: '2.0',
      error: {
        code: -32603,
        message: 'Internal error',
        data: error
      }
    } satisfies JSONRPCErrorResponse;
  }

  return {
    jsonrpc: '2.0',
    error: {
      code: -32000,
      message: 'Server error',
      data: error
    }
  };
};
