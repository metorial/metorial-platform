import type { JSONRPCErrorResponse } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

type McpSchema<T extends object> = {
  safeParse(input: unknown):
    | {
        success: true;
        data: T;
      }
    | {
        success: false;
        error: unknown;
      };
};

type McpValidatedData<T extends object> = T & {
  jsonrpc: '2.0';
  id: string | number | null;
};

let getMcpValidationErrorData = (error: unknown) => {
  if (error instanceof z.ZodError) {
    return z.treeifyError(error);
  }

  if (typeof error === 'object' && error !== null && 'issues' in error) {
    return {
      issues: (error as { issues: unknown }).issues
    };
  }

  return error;
};

export let mcpValidate = <T extends object>(
  id: string | number | null | undefined,
  schema: McpSchema<T>,
  data: unknown
) => {
  let res = schema.safeParse(data);
  if (res.success) {
    let parsedData = res.data;
    if (typeof parsedData !== 'object' || parsedData === null) {
      throw new Error('mcpValidate: Parsed data is not an object');
    }

    let messageId =
      id ??
      ('id' in parsedData &&
      (typeof parsedData.id === 'string' ||
        typeof parsedData.id === 'number' ||
        parsedData.id === null)
        ? parsedData.id
        : null);

    return {
      success: true as const,
      data: {
        ...parsedData,
        jsonrpc: '2.0' as const,
        id: messageId
      } as McpValidatedData<T>
    };
  }

  if (!('error' in res)) {
    throw new Error('mcpValidate: Failed validation result is missing an error');
  }

  return {
    success: false as const,
    error: {
      jsonrpc: '2.0',
      id: id ?? undefined,
      error: {
        code: -32602,
        message: 'Invalid params',
        data: getMcpValidationErrorData(res.error)
      }
    } satisfies JSONRPCErrorResponse
  };
};
